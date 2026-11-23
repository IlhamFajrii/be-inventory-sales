import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, login } from './helpers';

describe('Auth dan peran', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());

  it('login salah -> 401 dengan format error konsisten', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@demo.test', password: 'salah' })
      .expect(401);
    expect(res.body).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Email atau password salah',
    });
  });

  it('email tidak ada dan password salah menghasilkan respons identik', async () => {
    const a = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'tidak-ada@demo.test', password: 'apa-saja' });
    const b = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@demo.test', password: 'apa-saja' });
    expect(a.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });

  it('respons login tidak memuat password atau hash', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@demo.test', password: 'Admin123!demo' })
      .expect(200);
    expect(Object.keys(res.body)).toEqual(['accessToken']);
  });

  it('tanpa token -> 401', async () => {
    await request(app.getHttpServer()).get('/products').expect(401);
  });

  it('token palsu -> 401', async () => {
    await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', 'Bearer bukan.token.valid')
      .expect(401);
  });

  it('staf memanggil endpoint admin -> 403', async () => {
    const staf = await login(app, 'staf');
    const body = { sku: 'X-1', name: 'X', price: 1000, stock: 1 };
    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', staf)
      .send(body)
      .expect(403);
    expect(res.body.statusCode).toBe(403);
    await request(app.getHttpServer()).get('/reports/low-stock').set('Authorization', staf).expect(403);
  });

  it('staf boleh melihat produk', async () => {
    const staf = await login(app, 'staf');
    await request(app.getHttpServer()).get('/products').set('Authorization', staf).expect(200);
  });

  describe('peran dibaca dari database, bukan dari token', () => {
    const mk = async (email: string, role: Role) =>
      prisma.user.create({
        data: { email, name: email, role, passwordHash: await bcrypt.hash('password-uji-1', 4) },
      });
    const loginAs = async (email: string) =>
      `Bearer ${
        (
          await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email, password: 'password-uji-1' })
            .expect(200)
        ).body.accessToken
      }`;

    it('user yang dihapus: token lama langsung ditolak', async () => {
      const u = await mk('dihapus@demo.test', Role.STAFF);
      const token = await loginAs(u.email);
      await request(app.getHttpServer()).get('/products').set('Authorization', token).expect(200);
      await prisma.user.delete({ where: { id: u.id } });
      await request(app.getHttpServer()).get('/products').set('Authorization', token).expect(401);
    });

    it('admin yang diturunkan jadi staf: token lama tidak lagi boleh endpoint admin', async () => {
      const u = await mk('diturunkan@demo.test', Role.ADMIN);
      const token = await loginAs(u.email);
      await request(app.getHttpServer()).get('/reports/low-stock').set('Authorization', token).expect(200);
      await prisma.user.update({ where: { id: u.id }, data: { role: Role.STAFF } });
      await request(app.getHttpServer()).get('/reports/low-stock').set('Authorization', token).expect(403);
    });
  });
});

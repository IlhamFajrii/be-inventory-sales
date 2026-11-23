import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, login } from './helpers';

describe('Produk', () => {
  let app: INestApplication;
  let admin: string;
  beforeAll(async () => {
    ({ app } = await createApp());
    admin = await login(app, 'admin');
  });
  afterAll(() => app.close());

  const post = (body: object) =>
    request(app.getHttpServer()).post('/products').set('Authorization', admin).send(body);

  it('input tidak valid ditolak dengan pesan per field', async () => {
    const res = await post({ sku: '', name: 'A', price: -5, stock: 1.5 }).expect(400);
    expect(res.body.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    const msgs: string[] = res.body.message;
    for (const field of ['sku', 'price', 'stock']) {
      expect(msgs.some((m) => m.startsWith(field))).toBe(true);
    }
    expect(msgs.some((m) => m.startsWith('name'))).toBe(false);
  });

  it('field di luar DTO ditolak (forbidNonWhitelisted)', async () => {
    const res = await post({ sku: 'EX-1', name: 'A', price: 1, stock: 1, role: 'ADMIN' }).expect(400);
    expect(res.body.message).toContain('property role should not exist');
  });

  it('CRUD: buat, ubah, ambil, hapus', async () => {
    const created = await post({ sku: 'CR-1', name: 'Produk CRUD', price: 12500.5, stock: 7 }).expect(201);
    const id = created.body.id;
    expect(created.body.price).toBe('12500.5');

    const patched = await request(app.getHttpServer())
      .patch(`/products/${id}`)
      .set('Authorization', admin)
      .send({ stock: 9 })
      .expect(200);
    expect(patched.body.stock).toBe(9);

    await request(app.getHttpServer()).get(`/products/${id}`).set('Authorization', admin).expect(200);
    await request(app.getHttpServer()).delete(`/products/${id}`).set('Authorization', admin).expect(200);
    await request(app.getHttpServer()).get(`/products/${id}`).set('Authorization', admin).expect(404);
  });

  it('SKU duplikat -> 409', async () => {
    await post({ sku: 'DUP-1', name: 'A', price: 1, stock: 1 }).expect(201);
    const res = await post({ sku: 'DUP-1', name: 'B', price: 1, stock: 1 }).expect(409);
    expect(res.body.statusCode).toBe(409);
  });

  it('id bukan angka atau di luar rentang int32 -> 400, bukan 500', async () => {
    for (const id of ['abc', '0', '-1', '99999999999']) {
      await request(app.getHttpServer()).get(`/products/${id}`).set('Authorization', admin).expect(400);
    }
    await request(app.getHttpServer()).delete('/products/99999999999').set('Authorization', admin).expect(400);
  });

  it('nilai null ditolak 400 per field, bukan 500 (POST dan PATCH)', async () => {
    const created = await post({ sku: 'NULL-1', name: 'Uji null', price: 1000, stock: 1 }).expect(201);
    const res = await request(app.getHttpServer())
      .patch(`/products/${created.body.id}`)
      .set('Authorization', admin)
      .send({ name: null, price: null })
      .expect(400);
    expect(res.body.message).toEqual(['name tidak boleh null', 'price tidak boleh null']);
    await post({ sku: 'NULL-2', name: 'x', price: 1, stock: 1, minStock: null }).expect(400);
    // data tidak berubah
    const after = await request(app.getHttpServer())
      .get(`/products/${created.body.id}`)
      .set('Authorization', admin)
      .expect(200);
    expect(after.body.name).toBe('Uji null');
  });

  it('harga di atas batas ditolak 400', async () => {
    await post({ sku: 'BIG-0', name: 'x', price: 1_000_000_001, stock: 1 }).expect(400);
  });
});

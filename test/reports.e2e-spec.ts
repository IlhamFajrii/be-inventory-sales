import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, login } from './helpers';

const dayStr = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

describe('Laporan agregasi (cocok dengan seed, dihitung manual)', () => {
  let app: INestApplication;
  let admin: string;
  beforeAll(async () => {
    ({ app } = await createApp());
    admin = await login(app, 'admin');
  });
  afterAll(() => app.close());

  // Database e2e memakai timezone Asia/Jakarta (UTC+7) dan seed berjam 20:00 UTC, jadi
  // bila pemotongan hari memakai zona sesi, tanggal akan bergeser satu hari dan test ini gagal.
  it('penjualan per hari (tetap UTC walau zona sesi database bukan UTC)', async () => {
    // Seed: hari -2 = KP-001 x2 (170000) + MG-004 x1 (60000) + TH-002 x3 (135000) -> 2 penjualan, 6 item, 365000.
    // Hari -1 = GR-006 x1 (350000) + FL-005 x2 (110000) -> 1 penjualan, 3 item, 460000.
    const res = await request(app.getHttpServer())
      .get(`/reports/daily-sales?from=${dayStr(2)}&to=${dayStr(1)}`)
      .set('Authorization', admin)
      .expect(200);
    expect(res.body).toEqual([
      { date: dayStr(2), salesCount: 2, itemsSold: 6, revenue: '365000.00' },
      { date: dayStr(1), salesCount: 1, itemsSold: 3, revenue: '460000.00' },
    ]);
  });

  it('rentang tanpa penjualan -> array kosong', async () => {
    const res = await request(app.getHttpServer())
      .get('/reports/daily-sales?from=2020-01-01&to=2020-01-31')
      .set('Authorization', admin)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('parameter tanggal tidak valid -> 400', async () => {
    const get = (q: string) =>
      request(app.getHttpServer()).get(`/reports/daily-sales?${q}`).set('Authorization', admin);
    await get('from=kemarin').expect(400);
    await get('from=2026-13-45').expect(400);
    await get('from=2026-02-10&to=2026-02-01').expect(400);
  });

  it('stok menipis (stock <= minStock) urut dari yang paling sedikit', async () => {
    const res = await request(app.getHttpServer())
      .get('/reports/low-stock')
      .set('Authorization', admin)
      .expect(200);
    // Seed: MG-004 (3<=5), GR-006 (5<=5), TH-002 (8<=10). Produk uji lain boleh ikut muncul.
    const seeded = ['MG-004', 'GR-006', 'TH-002'];
    const skus = (res.body as { sku: string }[]).map((p) => p.sku).filter((s) => seeded.includes(s));
    expect(skus).toEqual(seeded);
    expect((res.body as { sku: string }[]).some((p) => p.sku === 'KP-001')).toBe(false);
  });
});

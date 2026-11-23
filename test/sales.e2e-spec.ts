import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, login } from './helpers';

describe('Transaksi penjualan', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let staf: string;
  beforeAll(async () => {
    ({ app, prisma } = await createApp());
    staf = await login(app, 'staf');
  });
  afterAll(() => app.close());

  const sell = (items: { productId: number; quantity: number }[]) =>
    request(app.getHttpServer()).post('/sales').set('Authorization', staf).send({ items });

  const mkProduct = (sku: string, stock: number, price = 10000) =>
    prisma.product.create({ data: { sku, name: sku, price, stock } });

  it('penjualan sukses: total benar dan stok berkurang', async () => {
    const a = await mkProduct('OK-A', 10, 15000);
    const b = await mkProduct('OK-B', 5, 2500);
    const res = await sell([
      { productId: a.id, quantity: 2 },
      { productId: b.id, quantity: 4 },
    ]).expect(201);
    expect(res.body.total).toBe('40000'); // 2*15000 + 4*2500
    expect(res.body.items).toHaveLength(2);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: a.id } })).stock).toBe(8);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: b.id } })).stock).toBe(1);
  });

  it('baris produk yang sama digabung sebelum cek stok', async () => {
    const p = await mkProduct('MERGE-1', 3);
    await sell([
      { productId: p.id, quantity: 2 },
      { productId: p.id, quantity: 2 },
    ]).expect(409);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(3);
  });

  it('stok kurang menolak seluruh transaksi, stok dan tabel penjualan tidak berubah', async () => {
    // a dibuat lebih dulu (id lebih kecil) sehingga stoknya sudah dikurangi sebelum b gagal.
    const a = await mkProduct('ATOM-A', 10);
    const b = await mkProduct('ATOM-B', 1);
    const salesBefore = await prisma.sale.count();
    const itemsBefore = await prisma.saleItem.count();

    const res = await sell([
      { productId: a.id, quantity: 3 },
      { productId: b.id, quantity: 2 },
    ]).expect(409);

    expect(res.body).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'Stok produk ATOM-B tidak cukup',
    });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: a.id } })).stock).toBe(10);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: b.id } })).stock).toBe(1);
    expect(await prisma.sale.count()).toBe(salesBefore);
    expect(await prisma.saleItem.count()).toBe(itemsBefore);
  });

  it('dua penjualan bersamaan atas stok terakhir: tepat satu berhasil', async () => {
    const p = await mkProduct('RACE-1', 1);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => sell([{ productId: p.id, quantity: 1 }])),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(5);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(0);
    expect(await prisma.saleItem.count({ where: { productId: p.id } })).toBe(1);
  });

  it('total penjualan terbesar yang mungkin tetap muat (tidak 500 setelah stok dikurangi)', async () => {
    const p = await mkProduct('BIG-1', 10_000, 1_000_000_000); // harga maksimum
    const res = await sell([{ productId: p.id, quantity: 10_000 }]).expect(201);
    expect(res.body.total).toBe('10000000000000');
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(0);
  });

  it('productId di luar rentang int32 -> 400, bukan 500', async () => {
    await sell([{ productId: 99_999_999_999, quantity: 1 }]).expect(400);
  });

  it('produk tidak ada -> 404, tanpa penjualan', async () => {
    const before = await prisma.sale.count();
    await sell([{ productId: 999999, quantity: 1 }]).expect(404);
    expect(await prisma.sale.count()).toBe(before);
  });

  it('validasi: items kosong dan quantity 0 -> 400', async () => {
    await sell([]).expect(400);
    await sell([{ productId: 1, quantity: 0 }]).expect(400);
  });
});

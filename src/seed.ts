import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Semua data fiktif. Akun demo didokumentasikan di README.
export const DEMO_USERS = [
  { email: 'admin@demo.test', name: 'Admin Demo', password: 'Admin123!demo', role: Role.ADMIN },
  { email: 'staf@demo.test', name: 'Staf Demo', password: 'Staf123!demo', role: Role.STAFF },
];

export const DEMO_PRODUCTS = [
  { sku: 'KP-001', name: 'Kopi Arabika 250g', price: 85000, stock: 40, minStock: 10 },
  { sku: 'TH-002', name: 'Teh Hijau Premium', price: 45000, stock: 8, minStock: 10 },
  { sku: 'GL-003', name: 'Gula Aren Cair', price: 32000, stock: 25, minStock: 5 },
  { sku: 'MG-004', name: 'Mug Keramik', price: 60000, stock: 3, minStock: 5 },
  { sku: 'FL-005', name: 'Filter Kertas V60 (isi 100)', price: 55000, stock: 15, minStock: 5 },
  { sku: 'GR-006', name: 'Grinder Manual', price: 350000, stock: 5, minStock: 5 },
];

// Penjualan demo, relatif terhadap hari ini (UTC, pukul 20:00) supaya laporan selalu berisi.
// Pukul 20:00 UTC sudah hari berikutnya di UTC+7, sehingga zona waktu salah akan terlihat di test.
// Hitungan manual: hari -2 = 2 penjualan, 6 item, 365000; hari -1 = 1 penjualan, 3 item, 460000.
export const DEMO_SALES = [
  { daysAgo: 2, user: 'admin@demo.test', items: [['KP-001', 2], ['MG-004', 1]] },
  { daysAgo: 2, user: 'staf@demo.test', items: [['TH-002', 3]] },
  { daysAgo: 1, user: 'staf@demo.test', items: [['GR-006', 1], ['FL-005', 2]] },
] as const;

export async function seed(prisma: PrismaClient) {
  for (const { password, ...u } of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash: await bcrypt.hash(password, 10) },
    });
  }
  // update kosong: menjalankan seed ulang tidak mengembalikan stok yang sudah berubah.
  for (const p of DEMO_PRODUCTS) {
    await prisma.product.upsert({ where: { sku: p.sku }, update: {}, create: p });
  }
  if ((await prisma.sale.count()) > 0) return;

  const todayUtc = new Date(new Date().toISOString().slice(0, 10) + 'T20:00:00Z');
  for (const s of DEMO_SALES) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: s.user } });
    const lines = await Promise.all(
      s.items.map(async ([sku, quantity]) => ({
        product: await prisma.product.findUniqueOrThrow({ where: { sku } }),
        quantity,
      })),
    );
    await prisma.sale.create({
      data: {
        userId: user.id,
        createdAt: new Date(todayUtc.getTime() - s.daysAgo * 86_400_000),
        total: lines.reduce((sum, l) => sum + Number(l.product.price) * l.quantity, 0),
        items: {
          create: lines.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
            unitPrice: l.product.price,
          })),
        },
      },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then(() => console.log('Seed selesai'))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

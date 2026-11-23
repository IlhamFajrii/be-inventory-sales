import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DailySalesQueryDto } from './reports.dto';

const DAY_MS = 86_400_000;

function parseDay(value: string, field: string): Date {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${field} bukan tanggal yang valid`);
  }
  return d;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async dailySales({ from, to }: DailySalesQueryDto) {
    const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    const end = to ? parseDay(to, 'to') : today;
    const start = from ? parseDay(from, 'from') : new Date(end.getTime() - 29 * DAY_MS);
    if (start > end) throw new BadRequestException('from tidak boleh setelah to');
    // Kolom createdAt bertipe `timestamp` tanpa zona yang berisi waktu UTC. Batas dikirim sebagai
    // string lalu di-cast ke `timestamp` (bukan Date), supaya hasilnya tidak bergantung pada
    // zona waktu sesi database.
    const startStr = `${start.toISOString().slice(0, 10)} 00:00:00`;
    const endStr = `${new Date(end.getTime() + DAY_MS).toISOString().slice(0, 10)} 00:00:00`;

    // Query terparameter (tagged template), tanggal dipotong di UTC.
    return this.prisma.$queryRaw<
      { date: string; salesCount: number; itemsSold: number; revenue: string }[]
    >`
      SELECT to_char(s."createdAt", 'YYYY-MM-DD') AS date,
             COUNT(DISTINCT s.id)::int AS "salesCount",
             SUM(si.quantity)::int AS "itemsSold",
             SUM(si.quantity * si."unitPrice")::text AS revenue
      FROM "Sale" s
      JOIN "SaleItem" si ON si."saleId" = s.id
      WHERE s."createdAt" >= ${startStr}::timestamp AND s."createdAt" < ${endStr}::timestamp
      GROUP BY 1
      ORDER BY 1`;
  }

  lowStock() {
    // Membandingkan dua kolom tidak bisa lewat filter Prisma biasa.
    return this.prisma.$queryRaw<
      { id: number; sku: string; name: string; stock: number; minStock: number }[]
    >`
      SELECT id, sku, name, stock, "minStock"
      FROM "Product"
      WHERE stock <= "minStock"
      ORDER BY stock ASC, id ASC`;
  }
}

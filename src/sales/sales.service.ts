import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './sale.dto';

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, dto: CreateSaleDto) {
    // Produk yang sama di beberapa baris digabung, lalu diurutkan menurut id
    // supaya dua transaksi bersamaan mengunci baris dengan urutan sama (tanpa deadlock).
    const qtyById = new Map<number, number>();
    for (const { productId, quantity } of dto.items) {
      qtyById.set(productId, (qtyById.get(productId) ?? 0) + quantity);
    }
    const ids = [...qtyById.keys()].sort((a, b) => a - b);

    return this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: ids } },
        orderBy: { id: 'asc' },
      });
      if (products.length !== ids.length) {
        const found = new Set(products.map((p) => p.id));
        throw new NotFoundException(
          `Produk tidak ditemukan: ${ids.filter((id) => !found.has(id)).join(', ')}`,
        );
      }

      let total = new Prisma.Decimal(0);
      const items: Prisma.SaleItemCreateWithoutSaleInput[] = [];
      for (const p of products) {
        const quantity = qtyById.get(p.id)!;
        // Kondisi stok ada di query yang sama dengan pengurangannya: tidak ada celah baca-lalu-tulis.
        const { count } = await tx.product.updateMany({
          where: { id: p.id, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (count === 0) {
          throw new ConflictException(`Stok produk ${p.sku} tidak cukup`);
        }
        total = total.add(p.price.mul(quantity));
        items.push({ product: { connect: { id: p.id } }, quantity, unitPrice: p.price });
      }

      // Melempar di mana pun di atas membatalkan seluruh transaksi, termasuk pengurangan stok sebelumnya.
      return tx.sale.create({
        data: { userId, total, items: { create: items } },
        include: { items: true },
      });
    });
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators';
import { IdPipe } from '../common/pipes';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './product.dto';

// Staf boleh melihat produk. Mengubah katalog dan stok hanya admin.
// Error Prisma (duplikat, tidak ada, masih dipakai) dipetakan oleh AllExceptionsFilter.
@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.product.findMany({ orderBy: { name: 'asc' } });
  }

  @Get(':id')
  findOne(@Param('id', IdPipe) id: number) {
    return this.prisma.product.findUniqueOrThrow({ where: { id } });
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', IdPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', IdPipe) id: number) {
    return this.prisma.product.delete({ where: { id } });
  }
}

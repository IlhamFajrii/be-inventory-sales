import { PartialType } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { IsOptional } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  sku!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000) // batas ini menjamin total penjualan muat di Decimal(18,2)
  price!: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  stock!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  minStock?: number;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

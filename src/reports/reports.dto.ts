import { IsOptional, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class DailySalesQueryDto {
  /** Tanggal awal (UTC), format YYYY-MM-DD. Bawaan: 29 hari sebelum `to`. */
  @IsOptional()
  @Matches(DATE, { message: 'from harus berformat YYYY-MM-DD' })
  from?: string;

  /** Tanggal akhir (UTC, inklusif), format YYYY-MM-DD. Bawaan: hari ini. */
  @IsOptional()
  @Matches(DATE, { message: 'to harus berformat YYYY-MM-DD' })
  to?: string;
}

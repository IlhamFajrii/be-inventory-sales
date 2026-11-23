import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators';
import { DailySalesQueryDto } from './reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('daily-sales')
  dailySales(@Query() q: DailySalesQueryDto) {
    return this.reports.dailySales(q);
  }

  @Get('low-stock')
  lowStock() {
    return this.reports.lowStock();
  }
}

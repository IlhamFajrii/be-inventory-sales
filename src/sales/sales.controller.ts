import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/decorators';
import { CreateSaleDto } from './sale.dto';
import { SalesService } from './sales.service';

@ApiTags('sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private sales: SalesService) {}

  @Post()
  create(@Req() req: { user: AuthUser }, @Body() dto: CreateSaleDto) {
    return this.sales.create(req.user.userId, dto);
  }
}

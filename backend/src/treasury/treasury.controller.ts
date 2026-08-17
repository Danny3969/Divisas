import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { TreasuryService } from './treasury.service';
import { Role } from '@prisma/client';

@Controller('treasury')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TreasuryController {
  constructor(private service: TreasuryService) {}

  @Get('overview')
  @Roles(Role.TREASURY, Role.ADMIN, Role.AUDITOR)
  overview() {
    return this.service.overview();
  }

  @Get('settlements')
  @Roles(Role.TREASURY, Role.ADMIN, Role.AUDITOR)
  settlements() {
    return this.service.listSettlements();
  }

  @Post('settlements')
  @Roles(Role.TREASURY, Role.ADMIN)
  createSettlement(
    @Body() data: { transferId: string; amount: number; currency: string },
  ) {
    return this.service.createSettlement(data.transferId, data.amount, data.currency);
  }
}

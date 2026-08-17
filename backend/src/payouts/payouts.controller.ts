import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { PayoutsService } from './payouts.service';
import { ProcessCashOutDto, ProcessBankPayoutDto } from './dto/payout.dto';
import { Role } from '@prisma/client';

@Controller('payouts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PayoutsController {
  constructor(private service: PayoutsService) {}

  @Get('withdrawal/validate/:code')
  @Roles(Role.CASHIER, Role.SUPERVISOR)
  validateCode(@Param('code') code: string) {
    return this.service.validateWithdrawalCode(code);
  }

  @Post('cash-out')
  @Roles(Role.CASHIER, Role.SUPERVISOR)
  processCashOut(@Body() dto: ProcessCashOutDto, @CurrentUser() user: AuthUser) {
    return this.service.processCashOut(dto, user);
  }

  @Post('bank')
  @Roles(Role.SUPERVISOR, Role.TREASURY, Role.ADMIN)
  processBank(@Body() dto: ProcessBankPayoutDto, @CurrentUser() user: AuthUser) {
    return this.service.processBankPayout(dto, user);
  }

  @Get('transfer/:transferId')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.TREASURY, Role.ADMIN, Role.AUDITOR)
  listByTransfer(@Param('transferId') transferId: string) {
    return this.service.listByTransfer(transferId);
  }
}

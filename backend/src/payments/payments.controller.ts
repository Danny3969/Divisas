import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { PaymentsService } from './payments.service';
import { RegisterCashPaymentDto, RegisterBankPaymentDto } from './dto/payment.dto';
import { Role } from '@prisma/client';

@Controller('payments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Post('cash')
  @Roles(Role.CASHIER, Role.SUPERVISOR)
  registerCash(@Body() dto: RegisterCashPaymentDto, @CurrentUser() user: AuthUser) {
    return this.service.registerCashPayment(dto, user);
  }

  @Post('bank')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.CUSTOMER)
  registerBank(@Body() dto: RegisterBankPaymentDto, @CurrentUser() user: AuthUser) {
    return this.service.registerBankPayment(dto, user);
  }

  @Post('bank/:id/confirm')
  @Roles(Role.SUPERVISOR, Role.TREASURY, Role.ADMIN)
  confirmBank(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.confirmBankPayment(id, user, 'Confirmado manualmente');
  }

  @Get('transfer/:transferId')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.TREASURY, Role.ADMIN, Role.AUDITOR)
  listByTransfer(@Param('transferId') transferId: string) {
    return this.service.listByTransfer(transferId);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { CashService } from './cash.service';
import { OpenCashSessionDto, CloseCashSessionDto, CreateCashAccountDto } from './dto/cash.dto';
import { Role } from '@prisma/client';

@Controller('cash')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CashController {
  constructor(private service: CashService) {}

  @Get('accounts')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.TREASURY, Role.ADMIN, Role.AUDITOR)
  accounts() {
    return this.service.listCashAccounts();
  }

  @Post('accounts')
  @Roles(Role.ADMIN, Role.TREASURY)
  createAccount(@Body() dto: CreateCashAccountDto, @CurrentUser() user: AuthUser) {
    return this.service.createCashAccount(dto, user);
  }

  @Post('sessions')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.ADMIN, Role.TREASURY)
  openSession(@Body() dto: OpenCashSessionDto, @CurrentUser() user: AuthUser) {
    return this.service.openSession(dto, user);
  }

  @Get('sessions/open/:cashAccountId')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.ADMIN)
  getOpenSession(@Param('cashAccountId') cashAccountId: string) {
    return this.service.getOpenSession(cashAccountId);
  }

  @Get('sessions')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.TREASURY, Role.ADMIN, Role.AUDITOR)
  sessions(@Query('status') status?: string, @Query('cashAccountId') cashAccountId?: string) {
    return this.service.listSessions({ status, cashAccountId });
  }

  @Patch('sessions/:id/close')
  @Roles(Role.CASHIER, Role.SUPERVISOR)
  closeSession(@Param('id') id: string, @Body() dto: CloseCashSessionDto, @CurrentUser() user: AuthUser) {
    return this.service.closeSession(id, dto, user);
  }

  @Get('movements/:cashAccountId')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.TREASURY, Role.ADMIN, Role.AUDITOR)
  movements(@Param('cashAccountId') cashAccountId: string) {
    return this.service.listMovements(cashAccountId);
  }
}

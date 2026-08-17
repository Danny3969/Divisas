import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { LedgerService } from './ledger.service';
import { CreateLedgerAccountDto } from './dto/ledger.dto';
import { Role } from '@prisma/client';

@Controller('ledger')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class LedgerController {
  constructor(private service: LedgerService) {}

  @Get('accounts')
  @Roles(Role.SUPERVISOR, Role.TREASURY, Role.ADMIN, Role.AUDITOR)
  accounts() {
    return this.service.listAccounts();
  }

  @Post('accounts')
  @Roles(Role.ADMIN, Role.TREASURY)
  createAccount(@Body() dto: CreateLedgerAccountDto, @CurrentUser() user: AuthUser) {
    return this.service.createAccount(dto, user);
  }

  @Post('accounts/seed')
  @Roles(Role.ADMIN)
  seed(@CurrentUser() user: AuthUser) {
    return this.service.seedDefaults();
  }

  @Get('entries')
  @Roles(Role.SUPERVISOR, Role.TREASURY, Role.ADMIN, Role.AUDITOR)
  entries(@Query('accountId') accountId?: string, @Query('transferId') transferId?: string, @Query('limit') limit?: string) {
    return this.service.listEntries({ accountId, transferId, limit: Number(limit) });
  }
}

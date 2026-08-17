import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { TransfersService } from './transfers.service';
import { CreateTransferDto, ChangeTransferStatusDto } from './dto/transfer.dto';
import { Role } from '@prisma/client';

@Controller('transfers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TransfersController {
  constructor(private service: TransfersService) {}

  @Post()
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.ADMIN, Role.CUSTOMER)
  create(@Body() dto: CreateTransferDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.COMPLIANCE, Role.TREASURY, Role.ADMIN, Role.AUDITOR)
  list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('senderId') senderId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list({ search, status, senderId, page: Number(page), limit: Number(limit) });
  }

  @Get('mine')
  @Roles(Role.CUSTOMER)
  listMine(@CurrentUser() user: AuthUser) {
    return this.service.listMine(user.userId);
  }

  @Get('reference/:ref')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.ADMIN)
  findByReference(@Param('ref') ref: string) {
    return this.service.findByReference(ref);
  }

  @Get(':id')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.COMPLIANCE, Role.TREASURY, Role.ADMIN, Role.AUDITOR, Role.CUSTOMER)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id/status')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.COMPLIANCE, Role.TREASURY, Role.ADMIN)
  transition(
    @Param('id') id: string,
    @Body() dto: ChangeTransferStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.transition(id, dto.toStatus, user, dto.note);
  }

  @Post(':id/regenerate-code')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  regenerateCode(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.regenerateWithdrawalCode(id, user);
  }

  @Get(':id/whatsapp-link')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.ADMIN, Role.CUSTOMER)
  getWhatsappLink(@Param('id') id: string) {
    return this.service.getWhatsappLink(id);
  }
}

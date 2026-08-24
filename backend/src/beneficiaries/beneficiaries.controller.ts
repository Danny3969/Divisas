import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto, CreateBeneficiaryAccountDto, UpdateBeneficiaryDto } from './dto/beneficiary.dto';
import { Role } from '@prisma/client';

@Controller('beneficiaries')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class BeneficiariesController {
  constructor(private service: BeneficiariesService) {}

  @Post()
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.ADMIN, Role.CUSTOMER)
  create(@Body() dto: CreateBeneficiaryDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Post(':id/accounts')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.ADMIN, Role.CUSTOMER)
  addAccount(@Param('id') id: string, @Body() dto: CreateBeneficiaryAccountDto, @CurrentUser() user: AuthUser) {
    return this.service.addAccount(id, dto, user);
  }

  @Get('customer/:customerId')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.ADMIN, Role.CUSTOMER)
  listByCustomer(@Param('customerId') customerId: string, @CurrentUser() user: AuthUser) {
    return this.service.listByCustomer(customerId, user);
  }

  @Get()
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.COMPLIANCE, Role.ADMIN, Role.AUDITOR)
  list(@Query('search') search?: string) {
    return this.service.list({ search });
  }

  @Patch(':id')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateBeneficiaryDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.delete(id, user);
  }
}

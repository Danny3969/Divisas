import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, ApproveKycDto } from './dto/customer.dto';
import { Role } from '@prisma/client';

@Controller('customers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CustomersController {
  constructor(private service: CustomersService) {}

  @Post()
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.ADMIN)
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.COMPLIANCE, Role.TREASURY, Role.ADMIN, Role.AUDITOR)
  list(@Query('search') search?: string, @Query('kycStatus') kycStatus?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.list({ search, kycStatus, page: Number(page), limit: Number(limit) });
  }

  @Get('document/:type/:number')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.ADMIN)
  findByDocument(@Param('type') type: string, @Param('number') number: string) {
    return this.service.findByDocument(type, number);
  }

  @Get('me')
  @Roles(Role.CUSTOMER)
  findMe(@CurrentUser() user: AuthUser) {
    return this.service.findByUser(user.userId);
  }

  @Get(':id')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.COMPLIANCE, Role.TREASURY, Role.ADMIN, Role.AUDITOR)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/kyc')
  @Roles(Role.COMPLIANCE, Role.SUPERVISOR, Role.ADMIN)
  approveKyc(@Param('id') id: string, @Body() dto: ApproveKycDto, @CurrentUser() user: AuthUser) {
    return this.service.approveKyc(id, dto, user);
  }
}

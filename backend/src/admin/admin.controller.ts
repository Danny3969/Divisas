import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { AdminService } from './admin.service';
import { Role } from '@prisma/client';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AdminController {
  constructor(private service: AdminService) {}

  @Get('dashboard')
  @Roles(Role.SUPERVISOR, Role.TREASURY, Role.ADMIN, Role.COMPLIANCE, Role.AUDITOR)
  dashboard() {
    return this.service.dashboard();
  }

  @Get('audit')
  @Roles(Role.ADMIN, Role.AUDITOR)
  auditLogs(@Query('entity') entity?: string, @Query('limit') limit?: string) {
    return this.service.auditLogs({ entity, limit: Number(limit) });
  }

  @Get('offices')
  @Roles(Role.ADMIN, Role.TREASURY)
  offices() {
    return this.service.listOffices();
  }

  @Post('offices')
  @Roles(Role.ADMIN)
  createOffice(@Body() data: { name: string; countryId: string; address?: string }) {
    return this.service.createOffice(data);
  }
}

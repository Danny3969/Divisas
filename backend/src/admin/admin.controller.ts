import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { AdminService } from './admin.service';
import { Role } from '@prisma/client';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AdminController {
  constructor(private service: AdminService) {}

  @Get('dashboard')
  @Roles(Role.SUPERVISOR, Role.TREASURY, Role.ADMIN, Role.COMPLIANCE, Role.AUDITOR)
  dashboard() {
    return this.service.dashboard();
  }

  @Get('users')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  listUsers() {
    return this.service.listUsers();
  }

  @Post('users')
  @Roles(Role.ADMIN)
  createUser(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.service.createUser(dto, user);
  }

  @Patch('users/:id')
  @Roles(Role.ADMIN)
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.service.updateUser(id, dto, user);
  }

  @Delete('users/:id')
  @Roles(Role.ADMIN)
  deleteUser(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.deleteUser(id, user);
  }

  @Post('users/:id/reset-password')
  @Roles(Role.ADMIN)
  resetUserPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto, @CurrentUser() user: AuthUser) {
    return this.service.resetUserPassword(id, dto.newPassword, user);
  }

  @Post('reset-demo-data')
  @Roles(Role.ADMIN)
  resetDemoData(@CurrentUser() user: AuthUser) {
    return this.service.resetDemoData(user);
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

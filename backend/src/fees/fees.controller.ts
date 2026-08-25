import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { FeesService } from './fees.service';
import { Role, CorridorDirection } from '@prisma/client';
import { CreateFeeTierDto, UpdateFeeTierDto } from './dto/fee.dto';

@Controller('fees')
export class FeesController {
  constructor(private readonly service: FeesService) {}

  @Get('tiers')
  listActive(@Query('direction') direction?: CorridorDirection) {
    return this.service.listActive(direction);
  }

  @Post('calculate')
  calculateFee(
    @Body('direction') direction: CorridorDirection,
    @Body('sendAmount') sendAmount: number,
    @Body('sellRate') sellRate: number,
  ) {
    return this.service.calculateFee(direction, Number(sendAmount), Number(sellRate));
  }

  @Get('admin/tiers')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.TREASURY, Role.CASHIER)
  listAll() {
    return this.service.listAll();
  }

  @Post('admin/tiers')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  create(@Body() dto: CreateFeeTierDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Patch('admin/tiers/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFeeTierDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete('admin/tiers/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.delete(id, user);
  }
}

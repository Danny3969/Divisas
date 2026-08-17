import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/quote.dto';
import { Role } from '@prisma/client';

@Controller('quotes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class QuotesController {
  constructor(private service: QuotesService) {}

  @Post()
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.ADMIN, Role.CUSTOMER)
  create(@Body() dto: CreateQuoteDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get(':id')
  @Roles(Role.CASHIER, Role.SUPERVISOR, Role.ADMIN, Role.CUSTOMER)
  findActive(@Param('id') id: string) {
    return this.service.findActive(id);
  }
}

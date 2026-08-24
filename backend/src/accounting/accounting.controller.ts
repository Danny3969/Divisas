import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { AccountingService } from './accounting.service';
import {
  CreateExpenseDto,
  CreateAccountTransferDto,
  CreateCapitalMovementDto,
} from './dto/accounting.dto';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@Controller('accounting')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('summary')
  getFinancialSummary() {
    return this.accountingService.getFinancialSummary();
  }

  // ==================== GASTOS ====================

  @Get('expenses')
  listExpenses(
    @Query('category') category?: string,
    @Query('currency') currency?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.accountingService.listExpenses({
      category,
      currency,
      search,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('expenses')
  createExpense(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.accountingService.createExpense(dto, actor);
  }

  @Delete('expenses/:id')
  deleteExpense(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.accountingService.deleteExpense(id, actor);
  }

  // ==================== TRASPASOS ====================

  @Get('account-transfers')
  listAccountTransfers() {
    return this.accountingService.listAccountTransfers();
  }

  @Post('account-transfers')
  createAccountTransfer(
    @Body() dto: CreateAccountTransferDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.accountingService.createAccountTransfer(dto, actor);
  }

  // ==================== CAPITAL ====================

  @Get('capital-movements')
  listCapitalMovements() {
    return this.accountingService.listCapitalMovements();
  }

  @Post('capital-movements')
  createCapitalMovement(
    @Body() dto: CreateCapitalMovementDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.accountingService.createCapitalMovement(dto, actor);
  }
}

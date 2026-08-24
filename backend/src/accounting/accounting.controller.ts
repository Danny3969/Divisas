import {
  Controller,
  Get,
  Post,
  Put,
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
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  CreatePayrollPaymentDto,
  CreateBankMovementDto,
  UploadBankStatementDto,
  MatchBankStatementLineDto,
  ResetInitialDataDto,
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

  // ==================== RESET & SALDOS INICIALES ====================

  @Post('reset-initial-data')
  @Roles(Role.ADMIN)
  resetInitialData(
    @Body() dto: ResetInitialDataDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.accountingService.resetInitialData(dto, actor);
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
  @Roles(Role.ADMIN, Role.TREASURY)
  deleteExpense(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.accountingService.deleteExpense(id, actor);
  }

  // ==================== PROVEEDORES ====================

  @Get('suppliers')
  listSuppliers(@Query('country') country?: string) {
    return this.accountingService.listSuppliers(country);
  }

  @Post('suppliers')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.accountingService.createSupplier(dto);
  }

  @Put('suppliers/:id')
  updateSupplier(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.accountingService.updateSupplier(id, dto);
  }

  @Delete('suppliers/:id')
  deleteSupplier(@Param('id') id: string) {
    return this.accountingService.deleteSupplier(id);
  }

  // ==================== EMPLEADOS / NÓMINA ====================

  @Get('employees')
  listEmployees(@Query('country') country?: string) {
    return this.accountingService.listEmployees(country);
  }

  @Post('employees')
  createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.accountingService.createEmployee(dto);
  }

  @Put('employees/:id')
  updateEmployee(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.accountingService.updateEmployee(id, dto);
  }

  @Delete('employees/:id')
  deleteEmployee(@Param('id') id: string) {
    return this.accountingService.deleteEmployee(id);
  }

  @Post('payroll/pay')
  createPayrollPayment(
    @Body() dto: CreatePayrollPaymentDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.accountingService.createPayrollPayment(dto, actor);
  }

  @Get('payroll/history')
  listPayrollPayments() {
    return this.accountingService.listPayrollPayments();
  }

  // ==================== BANCOS & EXTRACTOS ====================

  @Post('bank-movements')
  createBankMovement(
    @Body() dto: CreateBankMovementDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.accountingService.createBankMovement(dto, actor);
  }

  @Post('bank-statements/upload')
  uploadBankStatement(@Body() dto: UploadBankStatementDto) {
    return this.accountingService.uploadBankStatement(dto);
  }

  @Get('bank-statements')
  listBankStatements(@Query('bankAccountId') bankAccountId?: string) {
    return this.accountingService.listBankStatements(bankAccountId);
  }

  @Post('bank-statements/match')
  matchBankStatementLine(
    @Body() dto: MatchBankStatementLineDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.accountingService.matchBankStatementLine(dto, actor);
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

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/current-user.decorator';
import {
  CreateExpenseDto,
  CreateAccountTransferDto,
  CreateCapitalMovementDto,
  ExpenseCategory,
} from './dto/accounting.dto';
import { AuditAction, LedgerAccountType, LedgerEntrySide, TransferStatus } from '@prisma/client';

const CATEGORY_ACCOUNT_MAP: Record<ExpenseCategory, string> = {
  [ExpenseCategory.RENT]: '5010',
  [ExpenseCategory.UTILITIES]: '5020',
  [ExpenseCategory.PAYROLL]: '5030',
  [ExpenseCategory.BANK_FEES]: '5040',
  [ExpenseCategory.SOFTWARE_HOSTING]: '5050',
  [ExpenseCategory.OFFICE_SUPPLIES]: '5060',
  [ExpenseCategory.MARKETING]: '5070',
  [ExpenseCategory.TAXES]: '5080',
  [ExpenseCategory.OTHER]: '5090',
};

@Injectable()
export class AccountingService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * Helper para obtener o crear la cuenta del ledger
   */
  private async getOrCreateLedgerAccount(code: string, name: string, type: LedgerAccountType, currency: string) {
    return this.prisma.ledgerAccount.upsert({
      where: { code },
      update: {},
      create: { code, name, type, currency },
    });
  }

  /**
   * Determinar el código del ledger para una cuenta bancaria o caja
   */
  private async getAccountLedgerCode(params: {
    type: 'BANK' | 'CASH';
    bankAccountId?: string;
    cashAccountId?: string;
  }): Promise<{ code: string; name: string; currency: string }> {
    if (params.type === 'BANK') {
      if (!params.bankAccountId) throw new BadRequestException('Debe especificar la cuenta bancaria');
      const bank = await this.prisma.bankAccount.findUnique({
        where: { id: params.bankAccountId },
        include: { country: true },
      });
      if (!bank) throw new NotFoundException('Cuenta bancaria no encontrada');
      let code = '1010-EC';
      if (bank.bankCode === 'GUAYAQUIL') code = '1011-EC';
      else if (bank.bankCode === 'BCP' || bank.currency === 'PEN') code = '1010-PE';
      return { code, name: `${bank.bankName} (${bank.currency})`, currency: bank.currency };
    } else {
      if (!params.cashAccountId) throw new BadRequestException('Debe especificar la caja de efectivo');
      const cash = await this.prisma.cashAccount.findUnique({
        where: { id: params.cashAccountId },
      });
      if (!cash) throw new NotFoundException('Caja de efectivo no encontrada');
      const code = cash.currency === 'USD' ? '1020-EC' : '1020-PE';
      return { code, name: `Caja Efectivo ${cash.code} (${cash.currency})`, currency: cash.currency };
    }
  }

  // ==================== GASTOS Y FACTURAS ====================

  async createExpense(dto: CreateExpenseDto, actor: AuthUser) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.prisma.expense.count();
    const expenseNumber = `EXP-${yearMonth}-${String(count + 1).padStart(4, '0')}`;

    const subtotal = Number(dto.subtotal);
    const taxRate = Number(dto.taxRate ?? 0);
    const taxAmount = Number(dto.taxAmount ?? Math.round((subtotal * taxRate) / 100 * 100) / 100);
    const total = Number(dto.total ?? (subtotal + taxAmount));

    const source = await this.getAccountLedgerCode({
      type: dto.paymentSourceType,
      bankAccountId: dto.bankAccountId,
      cashAccountId: dto.cashAccountId,
    });

    const expenseAccountCode = CATEGORY_ACCOUNT_MAP[dto.category] || '5090';
    const taxAccountCode = dto.currency === 'USD' ? '1030-EC' : '1030-PE';

    const expenseAcc = await this.getOrCreateLedgerAccount(
      expenseAccountCode,
      `Gasto - ${dto.category}`,
      LedgerAccountType.EXPENSE,
      dto.currency,
    );
    const sourceAcc = await this.getOrCreateLedgerAccount(
      source.code,
      source.name,
      LedgerAccountType.ASSET,
      source.currency,
    );
    const taxAcc = taxAmount > 0
      ? await this.getOrCreateLedgerAccount(
          taxAccountCode,
          dto.currency === 'USD' ? 'IVA Crédito Tributario 15%' : 'IGV Crédito Fiscal 18%',
          LedgerAccountType.ASSET,
          dto.currency,
        )
      : null;

    const entryGroup = `${expenseNumber}-EXPENSE`;

    return this.prisma.$transaction(async (tx) => {
      // 1. Crear registro del gasto
      const expense = await tx.expense.create({
        data: {
          expenseNumber,
          category: dto.category,
          supplierName: dto.supplierName,
          supplierTaxId: dto.supplierTaxId,
          invoiceNumber: dto.invoiceNumber,
          currency: dto.currency,
          subtotal,
          taxRate,
          taxAmount,
          total,
          paymentSourceType: dto.paymentSourceType,
          bankAccountId: dto.bankAccountId,
          cashAccountId: dto.cashAccountId,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : now,
          receiptUrl: dto.receiptUrl,
          notes: dto.notes,
          entryGroupId: entryGroup,
          createdById: actor.userId,
        },
      });

      // 2. Descontar saldo de la cuenta de origen
      if (dto.paymentSourceType === 'BANK' && dto.bankAccountId) {
        await tx.bankAccount.update({
          where: { id: dto.bankAccountId },
          data: { balance: { decrement: total } },
        });
      } else if (dto.paymentSourceType === 'CASH' && dto.cashAccountId) {
        await tx.cashAccount.update({
          where: { id: dto.cashAccountId },
          data: { balance: { decrement: total } },
        });
      }

      // 3. Asientos contables de doble partida
      // Débito: Cuenta de Gasto (Subtotal)
      await tx.ledgerEntry.create({
        data: {
          accountId: expenseAcc.id,
          entryGroup,
          side: LedgerEntrySide.DEBIT,
          amount: subtotal,
          currency: dto.currency,
          description: `Gasto ${expenseNumber}: ${dto.supplierName} - ${dto.category}`,
        },
      });

      // Débito: Crédito Fiscal / IVA (si aplica)
      if (taxAcc && taxAmount > 0) {
        await tx.ledgerEntry.create({
          data: {
            accountId: taxAcc.id,
            entryGroup,
            side: LedgerEntrySide.DEBIT,
            amount: taxAmount,
            currency: dto.currency,
            description: `Impuesto Crédito Fiscal ${expenseNumber}: ${dto.supplierName}`,
          },
        });
      }

      // Crédito: Banco o Caja (Total pagado)
      await tx.ledgerEntry.create({
        data: {
          accountId: sourceAcc.id,
          entryGroup,
          side: LedgerEntrySide.CREDIT,
          amount: total,
          currency: dto.currency,
          description: `Pago Gasto ${expenseNumber}: ${dto.supplierName}`,
        },
      });

      // Actualizar balances contables
      await tx.ledgerAccount.update({
        where: { id: expenseAcc.id },
        data: { balance: { increment: subtotal } },
      });
      if (taxAcc && taxAmount > 0) {
        await tx.ledgerAccount.update({
          where: { id: taxAcc.id },
          data: { balance: { increment: taxAmount } },
        });
      }
      await tx.ledgerAccount.update({
        where: { id: sourceAcc.id },
        data: { balance: { decrement: total } },
      });

      await this.audit.record({
        actor,
        action: AuditAction.CREATE,
        entity: 'Expense',
        entityId: expense.id,
        after: expense,
      });

      return expense;
    });
  }

  async listExpenses(query: {
    category?: string;
    currency?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const where: any = {};
    if (query.category) where.category = query.category;
    if (query.currency) where.currency = query.currency;
    if (query.search) {
      where.OR = [
        { supplierName: { contains: query.search, mode: 'insensitive' } },
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { expenseNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.startDate || query.endDate) {
      where.paidAt = {};
      if (query.startDate) where.paidAt.gte = new Date(query.startDate);
      if (query.endDate) where.paidAt.lte = new Date(query.endDate);
    }

    return this.prisma.expense.findMany({
      where,
      include: {
        bankAccount: true,
        cashAccount: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { paidAt: 'desc' },
      take: Number(query.limit || 100),
    });
  }

  async deleteExpense(id: string, actor: AuthUser) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Gasto no encontrado');

    return this.prisma.$transaction(async (tx) => {
      // Revertir saldo
      if (expense.paymentSourceType === 'BANK' && expense.bankAccountId) {
        await tx.bankAccount.update({
          where: { id: expense.bankAccountId },
          data: { balance: { increment: expense.total } },
        });
      } else if (expense.paymentSourceType === 'CASH' && expense.cashAccountId) {
        await tx.cashAccount.update({
          where: { id: expense.cashAccountId },
          data: { balance: { increment: expense.total } },
        });
      }

      // Eliminar asientos asociados
      if (expense.entryGroupId) {
        await tx.ledgerEntry.deleteMany({
          where: { entryGroup: expense.entryGroupId },
        });
      }

      await tx.expense.delete({ where: { id } });

      await this.audit.record({
        actor,
        action: AuditAction.DELETE,
        entity: 'Expense',
        entityId: id,
        before: expense,
      });

      return { success: true, message: `Gasto ${expense.expenseNumber} eliminado y revertido con éxito.` };
    });
  }

  // ==================== TRASPASOS ENTRE CUENTAS ====================

  async createAccountTransfer(dto: CreateAccountTransferDto, actor: AuthUser) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.prisma.accountTransfer.count();
    const transferNumber = `TRF-${yearMonth}-${String(count + 1).padStart(4, '0')}`;
    const amount = Number(dto.amount);

    const fromSource = await this.getAccountLedgerCode({
      type: dto.fromType,
      bankAccountId: dto.fromBankAccountId,
      cashAccountId: dto.fromCashAccountId,
    });
    const toSource = await this.getAccountLedgerCode({
      type: dto.toType,
      bankAccountId: dto.toBankAccountId,
      cashAccountId: dto.toCashAccountId,
    });

    const fromAcc = await this.getOrCreateLedgerAccount(
      fromSource.code,
      fromSource.name,
      LedgerAccountType.ASSET,
      fromSource.currency,
    );
    const toAcc = await this.getOrCreateLedgerAccount(
      toSource.code,
      toSource.name,
      LedgerAccountType.ASSET,
      toSource.currency,
    );

    const entryGroup = `${transferNumber}-TRANSFER`;

    return this.prisma.$transaction(async (tx) => {
      // 1. Descontar del origen
      if (dto.fromType === 'BANK' && dto.fromBankAccountId) {
        await tx.bankAccount.update({
          where: { id: dto.fromBankAccountId },
          data: { balance: { decrement: amount } },
        });
      } else if (dto.fromType === 'CASH' && dto.fromCashAccountId) {
        await tx.cashAccount.update({
          where: { id: dto.fromCashAccountId },
          data: { balance: { decrement: amount } },
        });
      }

      // 2. Incrementar en el destino
      if (dto.toType === 'BANK' && dto.toBankAccountId) {
        await tx.bankAccount.update({
          where: { id: dto.toBankAccountId },
          data: { balance: { increment: amount } },
        });
      } else if (dto.toType === 'CASH' && dto.toCashAccountId) {
        await tx.cashAccount.update({
          where: { id: dto.toCashAccountId },
          data: { balance: { increment: amount } },
        });
      }

      // 3. Crear registro del traspaso
      const record = await tx.accountTransfer.create({
        data: {
          transferNumber,
          fromType: dto.fromType,
          fromBankAccountId: dto.fromBankAccountId,
          fromCashAccountId: dto.fromCashAccountId,
          toType: dto.toType,
          toBankAccountId: dto.toBankAccountId,
          toCashAccountId: dto.toCashAccountId,
          amount,
          currency: dto.currency,
          reference: dto.reference,
          receiptUrl: dto.receiptUrl,
          description: dto.description,
          transferredAt: now,
          createdById: actor.userId,
        },
      });

      // 4. Asientos contables
      // Débito a la cuenta destino
      await tx.ledgerEntry.create({
        data: {
          accountId: toAcc.id,
          entryGroup,
          side: LedgerEntrySide.DEBIT,
          amount,
          currency: dto.currency,
          description: `Traspaso entrante ${transferNumber} desde ${fromSource.name}`,
        },
      });

      // Crédito a la cuenta origen
      await tx.ledgerEntry.create({
        data: {
          accountId: fromAcc.id,
          entryGroup,
          side: LedgerEntrySide.CREDIT,
          amount,
          currency: dto.currency,
          description: `Traspaso saliente ${transferNumber} hacia ${toSource.name}`,
        },
      });

      await tx.ledgerAccount.update({
        where: { id: toAcc.id },
        data: { balance: { increment: amount } },
      });
      await tx.ledgerAccount.update({
        where: { id: fromAcc.id },
        data: { balance: { decrement: amount } },
      });

      await this.audit.record({
        actor,
        action: AuditAction.CREATE,
        entity: 'AccountTransfer',
        entityId: record.id,
        after: record,
      });

      return record;
    });
  }

  async listAccountTransfers() {
    return this.prisma.accountTransfer.findMany({
      include: {
        fromBankAccount: true,
        fromCashAccount: true,
        toBankAccount: true,
        toCashAccount: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { transferredAt: 'desc' },
      take: 100,
    });
  }

  // ==================== MOVIMIENTOS DE CAPITAL ====================

  async createCapitalMovement(dto: CreateCapitalMovementDto, actor: AuthUser) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.prisma.capitalMovement.count();
    const movementNumber = `CAP-${yearMonth}-${String(count + 1).padStart(4, '0')}`;
    const amount = Number(dto.amount);

    const source = await this.getAccountLedgerCode({
      type: dto.destinationType,
      bankAccountId: dto.bankAccountId,
      cashAccountId: dto.cashAccountId,
    });

    const targetAcc = await this.getOrCreateLedgerAccount(
      source.code,
      source.name,
      LedgerAccountType.ASSET,
      source.currency,
    );
    const equityAcc = await this.getOrCreateLedgerAccount(
      dto.type === 'INJECTION' ? '3010' : '3020',
      dto.type === 'INJECTION' ? 'Capital Social / Aportes de Socios' : 'Retiros de Utilidades / Dividendos',
      LedgerAccountType.EQUITY,
      dto.currency,
    );

    const entryGroup = `${movementNumber}-${dto.type}`;

    return this.prisma.$transaction(async (tx) => {
      // 1. Ajustar balance de banco/caja
      if (dto.destinationType === 'BANK' && dto.bankAccountId) {
        await tx.bankAccount.update({
          where: { id: dto.bankAccountId },
          data: { balance: dto.type === 'INJECTION' ? { increment: amount } : { decrement: amount } },
        });
      } else if (dto.destinationType === 'CASH' && dto.cashAccountId) {
        await tx.cashAccount.update({
          where: { id: dto.cashAccountId },
          data: { balance: dto.type === 'INJECTION' ? { increment: amount } : { decrement: amount } },
        });
      }

      // 2. Crear registro
      const record = await tx.capitalMovement.create({
        data: {
          movementNumber,
          type: dto.type,
          destinationType: dto.destinationType,
          bankAccountId: dto.bankAccountId,
          cashAccountId: dto.cashAccountId,
          amount,
          currency: dto.currency,
          partnerName: dto.partnerName,
          concept: dto.concept,
          receiptUrl: dto.receiptUrl,
          createdById: actor.userId,
        },
      });

      // 3. Asientos contables
      if (dto.type === 'INJECTION') {
        // Débito a Banco/Caja, Crédito a Capital Social
        await tx.ledgerEntry.create({
          data: {
            accountId: targetAcc.id,
            entryGroup,
            side: LedgerEntrySide.DEBIT,
            amount,
            currency: dto.currency,
            description: `Aporte de capital ${movementNumber} de ${dto.partnerName ?? 'Socio'}`,
          },
        });
        await tx.ledgerEntry.create({
          data: {
            accountId: equityAcc.id,
            entryGroup,
            side: LedgerEntrySide.CREDIT,
            amount,
            currency: dto.currency,
            description: `Aporte de capital ${movementNumber} a ${source.name}`,
          },
        });
      } else {
        // Retiro: Débito a Retiros de Utilidades, Crédito a Banco/Caja
        await tx.ledgerEntry.create({
          data: {
            accountId: equityAcc.id,
            entryGroup,
            side: LedgerEntrySide.DEBIT,
            amount,
            currency: dto.currency,
            description: `Retiro de utilidades ${movementNumber} por ${dto.partnerName ?? 'Socio'}`,
          },
        });
        await tx.ledgerEntry.create({
          data: {
            accountId: targetAcc.id,
            entryGroup,
            side: LedgerEntrySide.CREDIT,
            amount,
            currency: dto.currency,
            description: `Salida por retiro ${movementNumber} desde ${source.name}`,
          },
        });
      }

      return record;
    });
  }

  async listCapitalMovements() {
    return this.prisma.capitalMovement.findMany({
      include: {
        bankAccount: true,
        cashAccount: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ==================== DASHBOARD FINANCIERO Y P&L ====================

  async getFinancialSummary() {
    const [bankAccounts, cashAccounts, expenses, completedTransfers, ledgerAccounts] =
      await Promise.all([
        this.prisma.bankAccount.findMany({ include: { country: true } }),
        this.prisma.cashAccount.findMany({ include: { office: { include: { country: true } } } }),
        this.prisma.expense.findMany(),
        this.prisma.transfer.findMany({
          where: { status: { in: [TransferStatus.PAID, TransferStatus.COMPLETED] } },
          include: { quote: true },
        }),
        this.prisma.ledgerAccount.findMany({ orderBy: { code: 'asc' } }),
      ]);

    // 1. Saldos de Liquidez
    let totalBankUsd = 0;
    let totalBankPen = 0;
    for (const b of bankAccounts) {
      if (b.currency === 'USD') totalBankUsd += Number(b.balance);
      else totalBankPen += Number(b.balance);
    }

    let totalCashUsd = 0;
    let totalCashPen = 0;
    for (const c of cashAccounts) {
      if (c.currency === 'USD') totalCashUsd += Number(c.balance);
      else totalCashPen += Number(c.balance);
    }

    // 2. Ingresos por Comisiones y Margen FX
    let feeIncomeUsd = 0;
    let feeIncomePen = 0;
    let totalFxProfitUsd = 0;
    let totalTransferredVolumeUsd = 0;

    for (const t of completedTransfers) {
      if (t.feeCurrency === 'USD') feeIncomeUsd += Number(t.feeAmount);
      else feeIncomePen += Number(t.feeAmount);

      if (t.sendCurrency === 'USD') {
        totalTransferredVolumeUsd += Number(t.sendAmount);
      } else {
        totalTransferredVolumeUsd += Number(t.sendAmount) * 0.28; // Aproximado para métrica global
      }

      // Ganancia FX estimada (Spread)
      if (t.quote) {
        const spreadMargin = Math.abs(Number(t.sendAmount) * 0.015); // ~1.5% promedio de spread
        totalFxProfitUsd += spreadMargin;
      }
    }

    // 3. Gastos por categoría y totales
    let totalExpensesUsd = 0;
    let totalExpensesPen = 0;
    const expensesByCategory: Record<string, { count: number; totalUsd: number; totalPen: number }> = {};

    for (const e of expenses) {
      const cat = e.category;
      if (!expensesByCategory[cat]) {
        expensesByCategory[cat] = { count: 0, totalUsd: 0, totalPen: 0 };
      }
      expensesByCategory[cat].count += 1;
      if (e.currency === 'USD') {
        totalExpensesUsd += Number(e.total);
        expensesByCategory[cat].totalUsd += Number(e.total);
      } else {
        totalExpensesPen += Number(e.total);
        expensesByCategory[cat].totalPen += Number(e.total);
      }
    }

    // 4. Utilidad Neta (Net Profit)
    const totalRevenueUsd = feeIncomeUsd + totalFxProfitUsd;
    const netProfitUsd = totalRevenueUsd - totalExpensesUsd;

    const totalRevenuePen = feeIncomePen;
    const netProfitPen = totalRevenuePen - totalExpensesPen;

    return {
      liquidity: {
        totalUsd: totalBankUsd + totalCashUsd,
        totalPen: totalBankPen + totalCashPen,
        banks: {
          totalUsd: totalBankUsd,
          totalPen: totalBankPen,
          accounts: bankAccounts.map((b) => ({
            id: b.id,
            name: b.bankName,
            accountNumber: b.accountNumber,
            currency: b.currency,
            country: b.country?.name ?? 'Ecuador',
            balance: Number(b.balance),
          })),
        },
        cash: {
          totalUsd: totalCashUsd,
          totalPen: totalCashPen,
          accounts: cashAccounts.map((c) => ({
            id: c.id,
            code: c.code,
            currency: c.currency,
            country: c.currency === 'USD' ? 'Ecuador' : 'Perú',
            balance: Number(c.balance),
          })),
        },
      },
      pnl: {
        revenue: {
          feesUsd: Math.round(feeIncomeUsd * 100) / 100,
          feesPen: Math.round(feeIncomePen * 100) / 100,
          fxProfitUsd: Math.round(totalFxProfitUsd * 100) / 100,
          totalRevenueUsd: Math.round(totalRevenueUsd * 100) / 100,
          totalRevenuePen: Math.round(totalRevenuePen * 100) / 100,
        },
        expenses: {
          totalUsd: Math.round(totalExpensesUsd * 100) / 100,
          totalPen: Math.round(totalExpensesPen * 100) / 100,
          byCategory: expensesByCategory,
          count: expenses.length,
        },
        netProfit: {
          usd: Math.round(netProfitUsd * 100) / 100,
          pen: Math.round(netProfitPen * 100) / 100,
        },
        totalTransfersCompleted: completedTransfers.length,
        transferredVolumeUsd: Math.round(totalTransferredVolumeUsd * 100) / 100,
      },
      ledgerAccounts: ledgerAccounts.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        currency: a.currency,
        balance: Number(a.balance),
      })),
    };
  }
}

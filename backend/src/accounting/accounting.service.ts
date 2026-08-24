import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/current-user.decorator';
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
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ==================== DASHBOARD & RESUMEN FINANCIERO ====================

  async getFinancialSummary() {
    const bankAccounts = await this.prisma.bankAccount.findMany({
      where: { active: true },
      include: { country: true },
      orderBy: { bankName: 'asc' },
    });

    const cashAccounts = await this.prisma.cashAccount.findMany({
      where: { active: true },
      include: { office: { include: { country: true } } },
      orderBy: { code: 'asc' },
    });

    let totalBankUsd = 0;
    let totalBankPen = 0;
    for (const b of bankAccounts) {
      const bal = Number(b.balance);
      if (b.currency === 'USD') totalBankUsd += bal;
      else if (b.currency === 'PEN') totalBankPen += bal;
    }

    let totalCashUsd = 0;
    let totalCashPen = 0;
    for (const c of cashAccounts) {
      const bal = Number(c.balance);
      if (c.currency === 'USD') totalCashUsd += bal;
      else if (c.currency === 'PEN') totalCashPen += bal;
    }

    const expenses = await this.prisma.expense.findMany();
    let totalExpUsd = 0;
    let totalExpPen = 0;
    const expByCategory: Record<
      string,
      { count: number; totalUsd: number; totalPen: number }
    > = {};

    for (const exp of expenses) {
      const tot = Number(exp.total);
      if (exp.currency === 'USD') totalExpUsd += tot;
      else if (exp.currency === 'PEN') totalExpPen += tot;

      if (!expByCategory[exp.category]) {
        expByCategory[exp.category] = { count: 0, totalUsd: 0, totalPen: 0 };
      }
      expByCategory[exp.category].count += 1;
      if (exp.currency === 'USD') expByCategory[exp.category].totalUsd += tot;
      else expByCategory[exp.category].totalPen += tot;
    }

    const completedTransfers = await this.prisma.transfer.findMany({
      where: { status: 'COMPLETED' },
      select: {
        sendAmount: true,
        sendCurrency: true,
        feeAmount: true,
        feeCurrency: true,
        fxRate: true,
        receiveAmount: true,
        receiveCurrency: true,
      },
    });

    let feesUsd = 0;
    let feesPen = 0;
    let transferredVolumeUsd = 0;

    for (const t of completedTransfers) {
      const fee = Number(t.feeAmount);
      if (t.feeCurrency === 'USD') feesUsd += fee;
      else if (t.feeCurrency === 'PEN') feesPen += fee;

      if (t.sendCurrency === 'USD') transferredVolumeUsd += Number(t.sendAmount);
    }

    const fxProfitUsd = transferredVolumeUsd * 0.0075;
    const totalRevenueUsd = feesUsd + fxProfitUsd;
    const totalRevenuePen = feesPen;

    const netProfitUsd = totalRevenueUsd - totalExpUsd;
    const netProfitPen = totalRevenuePen - totalExpPen;

    const ledgerAccounts = await this.prisma.ledgerAccount.findMany({
      orderBy: { code: 'asc' },
    });

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
            country: b.country.name,
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
            country: c.office.country.name,
            balance: Number(c.balance),
          })),
        },
      },
      pnl: {
        revenue: {
          feesUsd,
          feesPen,
          fxProfitUsd,
          totalRevenueUsd,
          totalRevenuePen,
        },
        expenses: {
          totalUsd: totalExpUsd,
          totalPen: totalExpPen,
          byCategory: expByCategory,
          count: expenses.length,
        },
        netProfit: {
          usd: netProfitUsd,
          pen: netProfitPen,
        },
        totalTransfersCompleted: completedTransfers.length,
        transferredVolumeUsd,
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

  // ==================== RESET & SALDOS INICIALES REALES ====================

  async resetInitialData(dto: ResetInitialDataDto, actor?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Limpiar gastos, nóminas, traspasos, capital, extractos bancarios y asientos
      await tx.bankStatementLine.deleteMany();
      await tx.bankStatement.deleteMany();
      await tx.bankTransaction.deleteMany();
      await tx.payrollPayment.deleteMany();
      await tx.expense.deleteMany();
      await tx.accountTransfer.deleteMany();
      await tx.capitalMovement.deleteMany();
      await tx.paymentMatch.deleteMany();
      await tx.payment.deleteMany();
      await tx.payout.deleteMany();
      await tx.settlement.deleteMany();
      await tx.transferEvent.deleteMany();
      await tx.riskAssessment.deleteMany();
      await tx.ledgerEntry.deleteMany();
      await tx.transfer.deleteMany();
      await tx.quote.deleteMany();
      await tx.cashMovement.deleteMany();
      await tx.cashSession.deleteMany();

      // 2. Restablecer balance de cuentas del libro contable a 0
      await tx.ledgerAccount.updateMany({
        data: { balance: new Decimal(0) },
      });

      // 3. Buscar cuentas bancarias principales y cajas
      const pichincha = await tx.bankAccount.findFirst({
        where: {
          OR: [
            { bankCode: 'PICHINCHA' },
            { bankName: { contains: 'Pichincha', mode: 'insensitive' } },
            { currency: 'USD' },
          ],
        },
      });

      const bcp = await tx.bankAccount.findFirst({
        where: {
          OR: [
            { bankCode: 'BCP' },
            { bankName: { contains: 'BCP', mode: 'insensitive' } },
            { currency: 'PEN' },
          ],
        },
      });

      const cashEc = await tx.cashAccount.findFirst({
        where: { currency: 'USD' },
      });

      const cashPe = await tx.cashAccount.findFirst({
        where: { currency: 'PEN' },
      });

      // 4. Actualizar balances de cuentas
      if (pichincha) {
        await tx.bankAccount.update({
          where: { id: pichincha.id },
          data: { balance: new Decimal(dto.pichinchaBalanceUsd) },
        });
      }

      if (cashEc) {
        await tx.cashAccount.update({
          where: { id: cashEc.id },
          data: { balance: new Decimal(dto.cashEcBalanceUsd) },
        });
      }

      if (bcp) {
        await tx.bankAccount.update({
          where: { id: bcp.id },
          data: { balance: new Decimal(dto.bcpBalancePen) },
        });
      }

      if (cashPe) {
        await tx.cashAccount.update({
          where: { id: cashPe.id },
          data: { balance: new Decimal(dto.cashPeBalancePen) },
        });
      }

      // 5. Asientos de Apertura en Libro Contable (Capital Social Inicial)
      const entryGroupId = `OPENING-${new Date().toISOString().slice(0, 10)}`;

      const ensureAccount = async (
        code: string,
        name: string,
        type: any,
        currency: string,
      ) => {
        return tx.ledgerAccount.upsert({
          where: { code },
          update: {},
          create: { code, name, type, currency },
        });
      };

      const capitalSocialAcc = await ensureAccount(
        '3010',
        'Capital Social / Aportes de Socios',
        'EQUITY',
        'USD',
      );

      // Banco Pichincha USD
      if (dto.pichinchaBalanceUsd > 0) {
        const pichinchaLedger = await ensureAccount(
          '1010-EC',
          'Banco Pichincha (USD)',
          'ASSET',
          'USD',
        );
        await tx.ledgerEntry.create({
          data: {
            accountId: pichinchaLedger.id,
            entryGroup: entryGroupId,
            side: 'DEBIT',
            amount: new Decimal(dto.pichinchaBalanceUsd),
            currency: 'USD',
            description: `Saldo inicial apertura Banco Pichincha: ${dto.partnerName || 'Socio'}`,
          },
        });
        await tx.ledgerAccount.update({
          where: { id: pichinchaLedger.id },
          data: {
            balance: { increment: new Decimal(dto.pichinchaBalanceUsd) },
          },
        });
      }

      // Caja Ecuador USD
      if (dto.cashEcBalanceUsd > 0) {
        const cajaEcLedger = await ensureAccount(
          '1020-EC',
          'Caja Efectivo Ecuador (USD)',
          'ASSET',
          'USD',
        );
        await tx.ledgerEntry.create({
          data: {
            accountId: cajaEcLedger.id,
            entryGroup: entryGroupId,
            side: 'DEBIT',
            amount: new Decimal(dto.cashEcBalanceUsd),
            currency: 'USD',
            description: `Saldo inicial apertura Caja Ecuador: ${dto.partnerName || 'Socio'}`,
          },
        });
        await tx.ledgerAccount.update({
          where: { id: cajaEcLedger.id },
          data: {
            balance: { increment: new Decimal(dto.cashEcBalanceUsd) },
          },
        });
      }

      // Total USD Capital Entry
      const totalUsdInitial = dto.pichinchaBalanceUsd + dto.cashEcBalanceUsd;
      if (totalUsdInitial > 0) {
        await tx.ledgerEntry.create({
          data: {
            accountId: capitalSocialAcc.id,
            entryGroup: entryGroupId,
            side: 'CREDIT',
            amount: new Decimal(totalUsdInitial),
            currency: 'USD',
            description: `Aporte de Capital Inicial Ecuador USD: ${dto.partnerName || 'Socio'}`,
          },
        });
        await tx.ledgerAccount.update({
          where: { id: capitalSocialAcc.id },
          data: { balance: { increment: new Decimal(totalUsdInitial) } },
        });
      }

      // BCP PEN
      if (dto.bcpBalancePen > 0) {
        const bcpLedger = await ensureAccount(
          '1010-PE',
          'Banco BCP (PEN)',
          'ASSET',
          'PEN',
        );
        await tx.ledgerEntry.create({
          data: {
            accountId: bcpLedger.id,
            entryGroup: entryGroupId,
            side: 'DEBIT',
            amount: new Decimal(dto.bcpBalancePen),
            currency: 'PEN',
            description: `Saldo inicial apertura BCP Perú: ${dto.partnerName || 'Socio'}`,
          },
        });
        await tx.ledgerAccount.update({
          where: { id: bcpLedger.id },
          data: { balance: { increment: new Decimal(dto.bcpBalancePen) } },
        });
      }

      // Caja Perú PEN
      if (dto.cashPeBalancePen > 0) {
        const cajaPeLedger = await ensureAccount(
          '1020-PE',
          'Caja Efectivo Perú (PEN)',
          'ASSET',
          'PEN',
        );
        await tx.ledgerEntry.create({
          data: {
            accountId: cajaPeLedger.id,
            entryGroup: entryGroupId,
            side: 'DEBIT',
            amount: new Decimal(dto.cashPeBalancePen),
            currency: 'PEN',
            description: `Saldo inicial apertura Caja Perú: ${dto.partnerName || 'Socio'}`,
          },
        });
        await tx.ledgerAccount.update({
          where: { id: cajaPeLedger.id },
          data: { balance: { increment: new Decimal(dto.cashPeBalancePen) } },
        });
      }

      return {
        success: true,
        message: 'Contabilidad reseteada con saldos iniciales reales fijados con éxito.',
        balances: {
          pichinchaUsd: dto.pichinchaBalanceUsd,
          cashEcUsd: dto.cashEcBalanceUsd,
          bcpPen: dto.bcpBalancePen,
          cashPePen: dto.cashPeBalancePen,
        },
      };
    });
  }

  // ==================== GASTOS Y FACTURAS ====================

  async createExpense(dto: CreateExpenseDto, actor?: AuthUser) {
    const total = Number(dto.total);
    const subtotal = Number(dto.subtotal);
    const taxAmount = Number(dto.taxAmount);

    if (total <= 0) {
      throw new BadRequestException('El total del gasto debe ser mayor a 0');
    }

    const count = await this.prisma.expense.count();
    const now = new Date();
    const prefix = `EXP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const expenseNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;
    const entryGroupId = `${expenseNumber}-EXPENSE`;

    return this.prisma.$transaction(async (tx) => {
      // 1. Descontar saldo de la cuenta de origen
      let bankAcc: any = null;
      let cashAcc: any = null;

      if (dto.paymentSourceType === 'BANK') {
        if (!dto.bankAccountId) {
          throw new BadRequestException('Debe seleccionar la cuenta bancaria de pago');
        }
        bankAcc = await tx.bankAccount.findUnique({
          where: { id: dto.bankAccountId },
        });
        if (!bankAcc) throw new NotFoundException('Cuenta bancaria no encontrada');

        await tx.bankAccount.update({
          where: { id: dto.bankAccountId },
          data: { balance: { decrement: new Decimal(total) } },
        });
      } else {
        if (!dto.cashAccountId) {
          throw new BadRequestException('Debe seleccionar la caja de pago');
        }
        cashAcc = await tx.cashAccount.findUnique({
          where: { id: dto.cashAccountId },
        });
        if (!cashAcc) throw new NotFoundException('Caja de efectivo no encontrada');

        await tx.cashAccount.update({
          where: { id: dto.cashAccountId },
          data: { balance: { decrement: new Decimal(total) } },
        });
      }

      // 2. Crear el registro de gasto
      const expense = await tx.expense.create({
        data: {
          expenseNumber,
          category: dto.category,
          supplierId: dto.supplierId,
          supplierName: dto.supplierName,
          supplierTaxId: dto.supplierTaxId,
          invoiceNumber: dto.invoiceNumber,
          currency: dto.currency,
          subtotal: new Decimal(subtotal),
          taxRate: new Decimal(dto.taxRate),
          taxAmount: new Decimal(taxAmount),
          total: new Decimal(total),
          paymentSourceType: dto.paymentSourceType,
          bankAccountId: dto.bankAccountId,
          cashAccountId: dto.cashAccountId,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : now,
          receiptUrl: dto.receiptUrl,
          notes: dto.notes,
          entryGroupId,
          createdById: actor?.userId,
        },
      });

      // 3. Generar Asientos Contables
      const categoryAccountMap: Record<string, string> = {
        RENT: '5010',
        UTILITIES: '5020',
        PAYROLL: '5030',
        BANK_FEES: '5040',
        SOFTWARE_HOSTING: '5050',
        OFFICE_SUPPLIES: '5060',
        MARKETING: '5070',
        TAXES: '5080',
        OTHER: '5090',
      };
      const expAccCode = categoryAccountMap[dto.category] || '5090';

      const expenseAccount = await tx.ledgerAccount.findUnique({
        where: { code: expAccCode },
      });
      if (expenseAccount) {
        await tx.ledgerEntry.create({
          data: {
            accountId: expenseAccount.id,
            entryGroup: entryGroupId,
            side: 'DEBIT',
            amount: new Decimal(subtotal),
            currency: dto.currency,
            description: `Gasto ${expenseNumber}: ${dto.supplierName} - ${dto.category}`,
          },
        });
        await tx.ledgerAccount.update({
          where: { id: expenseAccount.id },
          data: { balance: { increment: new Decimal(subtotal) } },
        });
      }

      // IVA / IGV Crédito Tributario
      if (taxAmount > 0) {
        const taxCode = dto.currency === 'USD' ? '1030-EC' : '1030-PE';
        const taxAccount = await tx.ledgerAccount.findUnique({
          where: { code: taxCode },
        });
        if (taxAccount) {
          await tx.ledgerEntry.create({
            data: {
              accountId: taxAccount.id,
              entryGroup: entryGroupId,
              side: 'DEBIT',
              amount: new Decimal(taxAmount),
              currency: dto.currency,
              description: `Impuesto Crédito Fiscal ${expenseNumber}: ${dto.supplierName}`,
            },
          });
          await tx.ledgerAccount.update({
            where: { id: taxAccount.id },
            data: { balance: { increment: new Decimal(taxAmount) } },
          });
        }
      }

      // Haber (Crédito a Banco o Caja)
      let payCode = '1010-EC';
      if (dto.paymentSourceType === 'BANK') {
        payCode = dto.currency === 'USD' ? '1010-EC' : '1010-PE';
      } else {
        payCode = dto.currency === 'USD' ? '1020-EC' : '1020-PE';
      }

      const payAccount = await tx.ledgerAccount.findUnique({
        where: { code: payCode },
      });
      if (payAccount) {
        await tx.ledgerEntry.create({
          data: {
            accountId: payAccount.id,
            entryGroup: entryGroupId,
            side: 'CREDIT',
            amount: new Decimal(total),
            currency: dto.currency,
            description: `Pago Gasto ${expenseNumber}: ${dto.supplierName}`,
          },
        });
        await tx.ledgerAccount.update({
          where: { id: payAccount.id },
          data: { balance: { decrement: new Decimal(total) } },
        });
      }

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
        { supplierTaxId: { contains: query.search, mode: 'insensitive' } },
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
        supplier: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { paidAt: 'desc' },
      take: query.limit || 100,
    });
  }

  async deleteExpense(id: string, actor?: AuthUser) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Gasto no encontrado');

    return this.prisma.$transaction(async (tx) => {
      const tot = Number(expense.total);
      if (expense.paymentSourceType === 'BANK' && expense.bankAccountId) {
        await tx.bankAccount.update({
          where: { id: expense.bankAccountId },
          data: { balance: { increment: new Decimal(tot) } },
        });
      } else if (expense.paymentSourceType === 'CASH' && expense.cashAccountId) {
        await tx.cashAccount.update({
          where: { id: expense.cashAccountId },
          data: { balance: { increment: new Decimal(tot) } },
        });
      }

      if (expense.entryGroupId) {
        await tx.ledgerEntry.deleteMany({
          where: { entryGroup: expense.entryGroupId },
        });
      }

      return tx.expense.delete({ where: { id } });
    });
  }

  // ==================== PROVEEDORES ====================

  async listSuppliers(countryCode?: string) {
    const where: any = { active: true };
    if (countryCode) {
      const country = await this.prisma.country.findUnique({
        where: { code: countryCode },
      });
      if (country) where.countryId = country.id;
    }
    return this.prisma.supplier.findMany({
      where,
      include: { country: true },
      orderBy: { name: 'asc' },
    });
  }

  async createSupplier(dto: CreateSupplierDto) {
    const country = await this.prisma.country.findUnique({
      where: { code: dto.countryCode },
    });
    if (!country) throw new NotFoundException('País no encontrado');

    return this.prisma.supplier.create({
      data: {
        name: dto.name,
        taxId: dto.taxId,
        countryId: country.id,
        category: dto.category || 'OTHER',
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        bankName: dto.bankName,
        bankAccountNumber: dto.bankAccountNumber,
        notes: dto.notes,
      },
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    return this.prisma.supplier.update({
      where: { id },
      data: dto,
    });
  }

  async deleteSupplier(id: string) {
    return this.prisma.supplier.update({
      where: { id },
      data: { active: false },
    });
  }

  // ==================== TRABAJADORES Y NÓMINA ====================

  async listEmployees(countryCode?: string) {
    const where: any = { active: true };
    if (countryCode) {
      const country = await this.prisma.country.findUnique({
        where: { code: countryCode },
      });
      if (country) where.countryId = country.id;
    }
    return this.prisma.employee.findMany({
      where,
      include: { country: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async createEmployee(dto: CreateEmployeeDto) {
    const country = await this.prisma.country.findUnique({
      where: { code: dto.countryCode },
    });
    if (!country) throw new NotFoundException('País no encontrado');

    return this.prisma.employee.create({
      data: {
        fullName: dto.fullName,
        documentType: (dto.documentType as any) || 'CEDULA',
        documentNumber: dto.documentNumber,
        countryId: country.id,
        position: dto.position,
        baseSalary: new Decimal(dto.baseSalary),
        salaryCurrency: dto.salaryCurrency,
        paymentFrequency: dto.paymentFrequency || 'MONTHLY',
        bankName: dto.bankName,
        bankAccountNumber: dto.bankAccountNumber,
        phone: dto.phone,
        email: dto.email,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : new Date(),
      },
    });
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto) {
    const data: any = { ...dto };
    if (dto.baseSalary !== undefined) {
      data.baseSalary = new Decimal(dto.baseSalary);
    }
    return this.prisma.employee.update({
      where: { id },
      data,
    });
  }

  async deleteEmployee(id: string) {
    return this.prisma.employee.update({
      where: { id },
      data: { active: false },
    });
  }

  async createPayrollPayment(dto: CreatePayrollPaymentDto, actor?: AuthUser) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      include: { country: true },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado');

    const amount = Number(dto.amount);
    if (amount <= 0) throw new BadRequestException('Monto de nómina inválido');

    const count = await this.prisma.payrollPayment.count();
    const now = new Date();
    const prefix = `PAY-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const payrollNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;
    const entryGroupId = `${payrollNumber}-PAYROLL`;

    return this.prisma.$transaction(async (tx) => {
      // Descontar saldo
      if (dto.paymentSourceType === 'BANK') {
        if (!dto.bankAccountId) {
          throw new BadRequestException('Debe seleccionar la cuenta bancaria');
        }
        await tx.bankAccount.update({
          where: { id: dto.bankAccountId },
          data: { balance: { decrement: new Decimal(amount) } },
        });
      } else {
        if (!dto.cashAccountId) {
          throw new BadRequestException('Debe seleccionar la caja');
        }
        await tx.cashAccount.update({
          where: { id: dto.cashAccountId },
          data: { balance: { decrement: new Decimal(amount) } },
        });
      }

      // Crear registro de pago
      const payment = await tx.payrollPayment.create({
        data: {
          payrollNumber,
          employeeId: dto.employeeId,
          amount: new Decimal(amount),
          currency: dto.currency,
          period: dto.period,
          paymentSourceType: dto.paymentSourceType,
          bankAccountId: dto.bankAccountId,
          cashAccountId: dto.cashAccountId,
          receiptUrl: dto.receiptUrl,
          notes: dto.notes,
          entryGroupId,
          createdById: actor?.userId,
        },
      });

      // Asiento contable: DEBE 5030 Sueldos y Nómina, HABER Banco/Caja
      const payrollAccount = await tx.ledgerAccount.findUnique({
        where: { code: '5030' },
      });
      if (payrollAccount) {
        await tx.ledgerEntry.create({
          data: {
            accountId: payrollAccount.id,
            entryGroup: entryGroupId,
            side: 'DEBIT',
            amount: new Decimal(amount),
            currency: dto.currency,
            description: `Pago Nómina ${payrollNumber}: ${employee.fullName} (${dto.period})`,
          },
        });
        await tx.ledgerAccount.update({
          where: { id: payrollAccount.id },
          data: { balance: { increment: new Decimal(amount) } },
        });
      }

      let payCode = '1010-EC';
      if (dto.paymentSourceType === 'BANK') {
        payCode = dto.currency === 'USD' ? '1010-EC' : '1010-PE';
      } else {
        payCode = dto.currency === 'USD' ? '1020-EC' : '1020-PE';
      }

      const payAccount = await tx.ledgerAccount.findUnique({
        where: { code: payCode },
      });
      if (payAccount) {
        await tx.ledgerEntry.create({
          data: {
            accountId: payAccount.id,
            entryGroup: entryGroupId,
            side: 'CREDIT',
            amount: new Decimal(amount),
            currency: dto.currency,
            description: `Salida de fondos nómina ${payrollNumber}: ${employee.fullName}`,
          },
        });
        await tx.ledgerAccount.update({
          where: { id: payAccount.id },
          data: { balance: { decrement: new Decimal(amount) } },
        });
      }

      return payment;
    });
  }

  async listPayrollPayments() {
    return this.prisma.payrollPayment.findMany({
      include: {
        employee: true,
        bankAccount: true,
        cashAccount: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  // ==================== MOVIMIENTOS BANCARIOS DIRECTOS & EXTRACTOS ====================

  async createBankMovement(dto: CreateBankMovementDto, actor?: AuthUser) {
    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { id: dto.bankAccountId },
    });
    if (!bankAccount) throw new NotFoundException('Cuenta bancaria no encontrada');

    const amount = Number(dto.amount);
    if (amount <= 0) throw new BadRequestException('Monto inválido');

    const entryGroupId = `BANK-${dto.type}-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      if (dto.type === 'DEPOSIT') {
        await tx.bankAccount.update({
          where: { id: dto.bankAccountId },
          data: { balance: { increment: new Decimal(amount) } },
        });
      } else {
        await tx.bankAccount.update({
          where: { id: dto.bankAccountId },
          data: { balance: { decrement: new Decimal(amount) } },
        });
      }

      const txRecord = await tx.bankTransaction.create({
        data: {
          bankAccountId: dto.bankAccountId,
          amount: new Decimal(dto.type === 'DEPOSIT' ? amount : -amount),
          currency: dto.currency,
          description: dto.description || `Movimiento manual: ${dto.type}`,
          externalRef: dto.reference,
        },
      });

      const bankLedgerCode = bankAccount.currency === 'USD' ? '1010-EC' : '1010-PE';
      const bankLedger = await tx.ledgerAccount.findUnique({
        where: { code: bankLedgerCode },
      });

      if (bankLedger) {
        await tx.ledgerEntry.create({
          data: {
            accountId: bankLedger.id,
            entryGroup: entryGroupId,
            side: dto.type === 'DEPOSIT' ? 'DEBIT' : 'CREDIT',
            amount: new Decimal(amount),
            currency: dto.currency,
            description: `Movimiento bancario ${dto.type} ${bankAccount.bankName}: ${dto.description || dto.reference || ''}`,
          },
        });
        await tx.ledgerAccount.update({
          where: { id: bankLedger.id },
          data: {
            balance:
              dto.type === 'DEPOSIT'
                ? { increment: new Decimal(amount) }
                : { decrement: new Decimal(amount) },
          },
        });
      }

      return txRecord;
    });
  }

  async uploadBankStatement(dto: UploadBankStatementDto) {
    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { id: dto.bankAccountId },
    });
    if (!bankAccount) throw new NotFoundException('Cuenta bancaria no encontrada');

    let totalDeposits = 0;
    let totalWithdrawals = 0;

    for (const l of dto.lines) {
      const amt = Math.abs(Number(l.amount));
      if (l.type === 'DEPOSIT') totalDeposits += amt;
      else totalWithdrawals += amt;
    }

    return this.prisma.$transaction(async (tx) => {
      const statement = await tx.bankStatement.create({
        data: {
          bankAccountId: dto.bankAccountId,
          fileName: dto.fileName,
          totalDeposits: new Decimal(totalDeposits),
          totalWithdrawals: new Decimal(totalWithdrawals),
          linesCount: dto.lines.length,
          status: 'PENDING',
        },
      });

      for (const l of dto.lines) {
        const amt = Math.abs(Number(l.amount));
        await tx.bankStatementLine.create({
          data: {
            bankStatementId: statement.id,
            date: new Date(l.date),
            description: l.description,
            reference: l.reference,
            amount: new Decimal(amt),
            type: l.type,
            matched: false,
          },
        });
      }

      return statement;
    });
  }

  async listBankStatements(bankAccountId?: string) {
    const where: any = {};
    if (bankAccountId) where.bankAccountId = bankAccountId;

    return this.prisma.bankStatement.findMany({
      where,
      include: {
        bankAccount: true,
        lines: { orderBy: { date: 'desc' } },
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async matchBankStatementLine(dto: MatchBankStatementLineDto, actor?: AuthUser) {
    const line = await this.prisma.bankStatementLine.findUnique({
      where: { id: dto.lineId },
      include: { bankStatement: { include: { bankAccount: true } } },
    });
    if (!line) throw new NotFoundException('Línea de extracto no encontrada');

    return this.prisma.$transaction(async (tx) => {
      let matchedRef = dto.matchedRef || 'CONCILIADO-MANUAL';

      if (dto.action === 'CREATE_EXPENSE') {
        const count = await tx.expense.count();
        const now = new Date();
        const expenseNumber = `EXP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;
        matchedRef = expenseNumber;

        await tx.expense.create({
          data: {
            expenseNumber,
            category: dto.category || 'OTHER',
            supplierName: dto.supplierName || line.description,
            currency: line.bankStatement.bankAccount.currency,
            subtotal: line.amount,
            taxRate: new Decimal(0),
            taxAmount: new Decimal(0),
            total: line.amount,
            paymentSourceType: 'BANK',
            bankAccountId: line.bankStatement.bankAccountId,
            paidAt: line.date,
            notes: `Auto-generado desde Extracto Bancario: ${line.description}`,
            entryGroupId: `${expenseNumber}-EXPENSE`,
            createdById: actor?.userId,
          },
        });
      }

      const updatedLine = await tx.bankStatementLine.update({
        where: { id: dto.lineId },
        data: {
          matched: true,
          matchedType: dto.action,
          matchedRef,
        },
      });

      // Actualizar contador del extracto
      const matchedCount = await tx.bankStatementLine.count({
        where: { bankStatementId: line.bankStatementId, matched: true },
      });
      const totalCount = await tx.bankStatementLine.count({
        where: { bankStatementId: line.bankStatementId },
      });

      await tx.bankStatement.update({
        where: { id: line.bankStatementId },
        data: {
          matchedCount,
          status: matchedCount === totalCount ? 'RECONCILED' : 'PARTIALLY_MATCHED',
        },
      });

      return updatedLine;
    });
  }

  // ==================== TRASPASOS ENTRE CUENTAS ====================

  async createAccountTransfer(dto: CreateAccountTransferDto, actor?: AuthUser) {
    const amount = Number(dto.amount);
    if (amount <= 0) throw new BadRequestException('Monto de traspaso inválido');

    const count = await this.prisma.accountTransfer.count();
    const now = new Date();
    const prefix = `TRF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const transferNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.$transaction(async (tx) => {
      // 1. Restar de Origen
      if (dto.fromType === 'BANK') {
        if (!dto.fromBankAccountId) throw new BadRequestException('Falta cuenta bancaria origen');
        await tx.bankAccount.update({
          where: { id: dto.fromBankAccountId },
          data: { balance: { decrement: new Decimal(amount) } },
        });
      } else {
        if (!dto.fromCashAccountId) throw new BadRequestException('Falta caja origen');
        await tx.cashAccount.update({
          where: { id: dto.fromCashAccountId },
          data: { balance: { decrement: new Decimal(amount) } },
        });
      }

      // 2. Sumar a Destino
      if (dto.toType === 'BANK') {
        if (!dto.toBankAccountId) throw new BadRequestException('Falta cuenta bancaria destino');
        await tx.bankAccount.update({
          where: { id: dto.toBankAccountId },
          data: { balance: { increment: new Decimal(amount) } },
        });
      } else {
        if (!dto.toCashAccountId) throw new BadRequestException('Falta caja destino');
        await tx.cashAccount.update({
          where: { id: dto.toCashAccountId },
          data: { balance: { increment: new Decimal(amount) } },
        });
      }

      // 3. Crear registro
      const trf = await tx.accountTransfer.create({
        data: {
          transferNumber,
          fromType: dto.fromType,
          fromBankAccountId: dto.fromBankAccountId,
          fromCashAccountId: dto.fromCashAccountId,
          toType: dto.toType,
          toBankAccountId: dto.toBankAccountId,
          toCashAccountId: dto.toCashAccountId,
          amount: new Decimal(amount),
          currency: dto.currency,
          reference: dto.reference,
          receiptUrl: dto.receiptUrl,
          description: dto.description,
          createdById: actor?.userId,
        },
      });

      // 4. Asientos Contables
      const entryGroupId = `${transferNumber}-TRANSFER`;
      let fromLedgerCode = dto.fromType === 'BANK' ? '1010-EC' : '1020-EC';
      let toLedgerCode = dto.toType === 'BANK' ? '1010-EC' : '1020-EC';
      if (dto.currency === 'PEN') {
        fromLedgerCode = dto.fromType === 'BANK' ? '1010-PE' : '1020-PE';
        toLedgerCode = dto.toType === 'BANK' ? '1010-PE' : '1020-PE';
      }

      const fromAccount = await tx.ledgerAccount.findUnique({ where: { code: fromLedgerCode } });
      const toAccount = await tx.ledgerAccount.findUnique({ where: { code: toLedgerCode } });

      if (fromAccount && toAccount) {
        await tx.ledgerEntry.create({
          data: {
            accountId: toAccount.id,
            entryGroup: entryGroupId,
            side: 'DEBIT',
            amount: new Decimal(amount),
            currency: dto.currency,
            description: `Entrada por Traspaso ${transferNumber}`,
          },
        });
        await tx.ledgerAccount.update({
          where: { id: toAccount.id },
          data: { balance: { increment: new Decimal(amount) } },
        });

        await tx.ledgerEntry.create({
          data: {
            accountId: fromAccount.id,
            entryGroup: entryGroupId,
            side: 'CREDIT',
            amount: new Decimal(amount),
            currency: dto.currency,
            description: `Salida por Traspaso ${transferNumber}`,
          },
        });
        await tx.ledgerAccount.update({
          where: { id: fromAccount.id },
          data: { balance: { decrement: new Decimal(amount) } },
        });
      }

      return trf;
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
    });
  }

  // ==================== MOVIMIENTOS DE CAPITAL ====================

  async createCapitalMovement(dto: CreateCapitalMovementDto, actor?: AuthUser) {
    const amount = Number(dto.amount);
    if (amount <= 0) throw new BadRequestException('Monto inválido');

    const count = await this.prisma.capitalMovement.count();
    const now = new Date();
    const prefix = `CAP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const movementNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.$transaction(async (tx) => {
      if (dto.type === 'INJECTION') {
        if (dto.destinationType === 'BANK') {
          if (!dto.bankAccountId) throw new BadRequestException('Falta cuenta bancaria');
          await tx.bankAccount.update({
            where: { id: dto.bankAccountId },
            data: { balance: { increment: new Decimal(amount) } },
          });
        } else {
          if (!dto.cashAccountId) throw new BadRequestException('Falta caja');
          await tx.cashAccount.update({
            where: { id: dto.cashAccountId },
            data: { balance: { increment: new Decimal(amount) } },
          });
        }
      } else {
        if (dto.destinationType === 'BANK') {
          if (!dto.bankAccountId) throw new BadRequestException('Falta cuenta bancaria');
          await tx.bankAccount.update({
            where: { id: dto.bankAccountId },
            data: { balance: { decrement: new Decimal(amount) } },
          });
        } else {
          if (!dto.cashAccountId) throw new BadRequestException('Falta caja');
          await tx.cashAccount.update({
            where: { id: dto.cashAccountId },
            data: { balance: { decrement: new Decimal(amount) } },
          });
        }
      }

      const movement = await tx.capitalMovement.create({
        data: {
          movementNumber,
          type: dto.type,
          destinationType: dto.destinationType,
          bankAccountId: dto.bankAccountId,
          cashAccountId: dto.cashAccountId,
          amount: new Decimal(amount),
          currency: dto.currency,
          partnerName: dto.partnerName,
          concept: dto.concept,
          receiptUrl: dto.receiptUrl,
          createdById: actor?.userId,
        },
      });

      const entryGroupId = `${movementNumber}-CAPITAL`;
      const capitalAccount = await tx.ledgerAccount.findUnique({
        where: { code: dto.type === 'INJECTION' ? '3010' : '3020' },
      });

      let assetCode = dto.destinationType === 'BANK' ? '1010-EC' : '1020-EC';
      if (dto.currency === 'PEN') {
        assetCode = dto.destinationType === 'BANK' ? '1010-PE' : '1020-PE';
      }
      const assetAccount = await tx.ledgerAccount.findUnique({ where: { code: assetCode } });

      if (capitalAccount && assetAccount) {
        if (dto.type === 'INJECTION') {
          await tx.ledgerEntry.create({
            data: {
              accountId: assetAccount.id,
              entryGroup: entryGroupId,
              side: 'DEBIT',
              amount: new Decimal(amount),
              currency: dto.currency,
              description: `Aporte Capital ${movementNumber}: ${dto.partnerName || 'Socio'}`,
            },
          });
          await tx.ledgerAccount.update({
            where: { id: assetAccount.id },
            data: { balance: { increment: new Decimal(amount) } },
          });

          await tx.ledgerEntry.create({
            data: {
              accountId: capitalAccount.id,
              entryGroup: entryGroupId,
              side: 'CREDIT',
              amount: new Decimal(amount),
              currency: dto.currency,
              description: `Aporte Capital Social ${movementNumber}: ${dto.partnerName || 'Socio'}`,
            },
          });
          await tx.ledgerAccount.update({
            where: { id: capitalAccount.id },
            data: { balance: { increment: new Decimal(amount) } },
          });
        } else {
          await tx.ledgerEntry.create({
            data: {
              accountId: capitalAccount.id,
              entryGroup: entryGroupId,
              side: 'DEBIT',
              amount: new Decimal(amount),
              currency: dto.currency,
              description: `Retiro de Utilidades ${movementNumber}: ${dto.partnerName || 'Socio'}`,
            },
          });
          await tx.ledgerAccount.update({
            where: { id: capitalAccount.id },
            data: { balance: { increment: new Decimal(amount) } },
          });

          await tx.ledgerEntry.create({
            data: {
              accountId: assetAccount.id,
              entryGroup: entryGroupId,
              side: 'CREDIT',
              amount: new Decimal(amount),
              currency: dto.currency,
              description: `Salida de Fondos Retiro Utilidades ${movementNumber}`,
            },
          });
          await tx.ledgerAccount.update({
            where: { id: assetAccount.id },
            data: { balance: { decrement: new Decimal(amount) } },
          });
        }
      }

      return movement;
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
    });
  }
}

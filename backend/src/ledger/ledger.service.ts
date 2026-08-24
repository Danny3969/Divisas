import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLedgerAccountDto, LedgerEntryInput } from './dto/ledger.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/current-user.decorator';
import { AuditAction, LedgerAccountType, LedgerEntrySide } from '@prisma/client';

export const LEDGER_ACCOUNTS = [
  // 1000 - Activos (Ecuador USD)
  { code: '1010-EC', name: 'Banco Pichincha (USD)', type: LedgerAccountType.ASSET, currency: 'USD' },
  { code: '1011-EC', name: 'Banco Guayaquil (USD)', type: LedgerAccountType.ASSET, currency: 'USD' },
  { code: '1020-EC', name: 'Caja Efectivo Ecuador (USD)', type: LedgerAccountType.ASSET, currency: 'USD' },
  { code: '1030-EC', name: 'IVA Crédito Tributario 15% (USD)', type: LedgerAccountType.ASSET, currency: 'USD' },

  // 1000 - Activos (Perú PEN)
  { code: '1010-PE', name: 'Banco BCP (PEN)', type: LedgerAccountType.ASSET, currency: 'PEN' },
  { code: '1020-PE', name: 'Caja Efectivo Perú (PEN)', type: LedgerAccountType.ASSET, currency: 'PEN' },
  { code: '1030-PE', name: 'IGV Crédito Fiscal 18% (PEN)', type: LedgerAccountType.ASSET, currency: 'PEN' },

  // 2000 - Pasivos
  { code: '2030-EC', name: 'Pasivo remesas por pagar Ecuador (USD)', type: LedgerAccountType.LIABILITY, currency: 'USD' },
  { code: '2030-PE', name: 'Pasivo remesas por pagar Perú (PEN)', type: LedgerAccountType.LIABILITY, currency: 'PEN' },
  { code: '2040-EC', name: 'Cuentas por pagar proveedores (USD)', type: LedgerAccountType.LIABILITY, currency: 'USD' },
  { code: '2040-PE', name: 'Cuentas por pagar proveedores (PEN)', type: LedgerAccountType.LIABILITY, currency: 'PEN' },

  // 3000 - Patrimonio
  { code: '3010', name: 'Capital Social / Aportes de Socios', type: LedgerAccountType.EQUITY, currency: 'USD' },
  { code: '3020', name: 'Retiros de Utilidades / Dividendos', type: LedgerAccountType.EQUITY, currency: 'USD' },

  // 4000 - Ingresos
  { code: '4010', name: 'Ingresos por comisiones de giros (USD)', type: LedgerAccountType.INCOME, currency: 'USD' },
  { code: '4011', name: 'Ingresos por comisiones de giros (PEN)', type: LedgerAccountType.INCOME, currency: 'PEN' },
  { code: '4020', name: 'Ganancia por diferencial cambiario (FX Spread)', type: LedgerAccountType.INCOME, currency: 'USD' },

  // 5000 - Gastos Operativos
  { code: '5010', name: 'Alquiler y Arriendos', type: LedgerAccountType.EXPENSE, currency: 'USD' },
  { code: '5020', name: 'Servicios Básicos (Luz, Agua, Internet, Teléfono)', type: LedgerAccountType.EXPENSE, currency: 'USD' },
  { code: '5030', name: 'Sueldos y Nómina de Personal', type: LedgerAccountType.EXPENSE, currency: 'USD' },
  { code: '5040', name: 'Comisiones Bancarias y Pasarelas', type: LedgerAccountType.EXPENSE, currency: 'USD' },
  { code: '5050', name: 'Software, Servidores y Hosting', type: LedgerAccountType.EXPENSE, currency: 'USD' },
  { code: '5060', name: 'Suministros de Oficina y Papelería', type: LedgerAccountType.EXPENSE, currency: 'USD' },
  { code: '5070', name: 'Publicidad y Marketing', type: LedgerAccountType.EXPENSE, currency: 'USD' },
  { code: '5080', name: 'Impuestos y Tasas Municipales', type: LedgerAccountType.EXPENSE, currency: 'USD' },
  { code: '5090', name: 'Gastos Operativos Varios', type: LedgerAccountType.EXPENSE, currency: 'USD' },
];

@Injectable()
export class LedgerService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async createAccount(dto: CreateLedgerAccountDto, actor: AuthUser) {
    const account = await this.prisma.ledgerAccount.create({ data: dto });
    await this.audit.record({ actor, action: AuditAction.CREATE, entity: 'LedgerAccount', entityId: account.id, after: dto });
    return account;
  }

  async seedDefaults() {
    for (const acc of LEDGER_ACCOUNTS) {
      await this.prisma.ledgerAccount.upsert({
        where: { code: acc.code },
        update: {},
        create: acc,
      });
    }
    return this.listAccounts();
  }

  async listAccounts() {
    const accounts = await this.prisma.ledgerAccount.findMany({ orderBy: { code: 'asc' } });
    // Derivar balance real desde los asientos (nunca confiar en el campo balance)
    const entries = await this.prisma.ledgerEntry.findMany();
    const totals = new Map<string, number>();
    for (const e of entries) {
      const cur = totals.get(e.accountId) ?? 0;
      totals.set(e.accountId, cur + (e.side === LedgerEntrySide.DEBIT ? Number(e.amount) : -Number(e.amount)));
    }
    return accounts.map((a) => ({
      ...a,
      computedBalance: Math.round((totals.get(a.id) ?? 0) * 100) / 100,
    }));
  }

  async getAccountByCode(code: string) {
    return this.prisma.ledgerAccount.findUnique({ where: { code } });
  }

  async mustGetAccountByCode(code: string) {
    const account = await this.prisma.ledgerAccount.findUnique({ where: { code } });
    if (!account) throw new NotFoundException(`Cuenta contable ${code} no existe. Ejecuta el seed.`);
    return account;
  }

  /**
   * Asiento de doble partida atómico. El débito total debe igualar el crédito total.
   */
  async postDoubleEntry(params: {
    entryGroup: string;
    transferId?: string;
    entries: LedgerEntryInput[];
    actor: AuthUser;
  }) {
    const debitTotal = params.entries.filter((e) => e.side === LedgerEntrySide.DEBIT).reduce((a, e) => a + e.amount, 0);
    const creditTotal = params.entries.filter((e) => e.side === LedgerEntrySide.CREDIT).reduce((a, e) => a + e.amount, 0);
    if (Math.abs(debitTotal - creditTotal) > 0.01) {
      throw new BadRequestException(
        `Asiento desbalanceado: débito ${debitTotal} ≠ crédito ${creditTotal}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      for (const e of params.entries) {
        const account = await tx.ledgerAccount.findUnique({ where: { id: e.accountId } });
        if (!account) throw new NotFoundException(`Cuenta contable ${e.accountId} no encontrada`);
        await tx.ledgerEntry.create({
          data: {
            accountId: e.accountId,
            transferId: params.transferId,
            entryGroup: params.entryGroup,
            side: e.side,
            amount: e.amount,
            currency: e.currency,
            description: e.description,
          },
        });
        const delta = e.side === LedgerEntrySide.DEBIT ? e.amount : -e.amount;
        await tx.ledgerAccount.update({
          where: { id: e.accountId },
          data: { balance: { increment: delta } },
        });
      }
    });

    await this.audit.record({
      actor: params.actor,
      action: AuditAction.CREATE,
      entity: 'LedgerEntry',
      entityId: params.entryGroup,
      after: { entries: params.entries },
    });
    return result;
  }

  async listEntries(query: { accountId?: string; transferId?: string; limit?: number }) {
    const where: any = {};
    if (query.accountId) where.accountId = query.accountId;
    if (query.transferId) where.transferId = query.transferId;
    return this.prisma.ledgerEntry.findMany({
      where,
      include: { account: true },
      orderBy: { createdAt: 'desc' },
      take: Number(query.limit || 200),
    });
  }
}

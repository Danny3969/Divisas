import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLedgerAccountDto, LedgerEntryInput } from './dto/ledger.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/current-user.decorator';
import { AuditAction, LedgerAccountType, LedgerEntrySide } from '@prisma/client';

export const LEDGER_ACCOUNTS = [
  // Ecuador (USD)
  { code: '1010-EC', name: 'Banco Ecuador (USD)', type: LedgerAccountType.ASSET, currency: 'USD' },
  { code: '1020-EC', name: 'Caja Ecuador (USD)', type: LedgerAccountType.ASSET, currency: 'USD' },
  { code: '2030-EC', name: 'Pasivo remesas Ecuador (USD)', type: LedgerAccountType.LIABILITY, currency: 'USD' },
  // Perú (PEN)
  { code: '1010-PE', name: 'Banco Perú (PEN)', type: LedgerAccountType.ASSET, currency: 'PEN' },
  { code: '1020-PE', name: 'Caja Perú (PEN)', type: LedgerAccountType.ASSET, currency: 'PEN' },
  { code: '2030-PE', name: 'Pasivo remesas Perú (PEN)', type: LedgerAccountType.LIABILITY, currency: 'PEN' },
  // Resultado
  { code: '4010', name: 'Ingresos por comisión (USD)', type: LedgerAccountType.INCOME, currency: 'USD' },
  { code: '4011', name: 'Ingresos por comisión (PEN)', type: LedgerAccountType.INCOME, currency: 'PEN' },
  { code: '5010', name: 'Gastos operativos', type: LedgerAccountType.EXPENSE, currency: 'USD' },
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

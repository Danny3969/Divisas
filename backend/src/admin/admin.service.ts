import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TransferStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async dashboard() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalTransfers, todayTransfers, byStatus, pendingCount, cashAccounts, ledgerAccounts, auditRecent, feeIncome] =
      await Promise.all([
        this.prisma.transfer.count(),
        this.prisma.transfer.count({ where: { createdAt: { gte: todayStart } } }),
        this.prisma.transfer.groupBy({ by: ['status'], _count: true }),
        this.prisma.transfer.count({
          where: {
            status: {
              in: [TransferStatus.AWAITING_PAYMENT, TransferStatus.PAYMENT_RECEIVED, TransferStatus.MANUAL_REVIEW, TransferStatus.AML_REVIEW, TransferStatus.RISK_BLOCKED, TransferStatus.PAYOUT_PROCESSING],
            },
          },
        }),
        this.prisma.cashAccount.findMany({ include: { office: { include: { country: true } } } }),
        this.prisma.ledgerAccount.findMany({ orderBy: { code: 'asc' } }),
        this.prisma.auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
        this.prisma.ledgerEntry.findMany({
          where: { account: { is: { type: 'INCOME' } } },
          include: { account: true },
        }),
      ]);

    const totals = { USD: 0, PEN: 0 };
    const volumeByCurrency = await this.prisma.transfer.aggregate({
      _sum: { sendAmount: true },
      where: { createdAt: { gte: todayStart } },
    });

    const income = incomeByCurrency(feeIncome);

    return {
      totalTransfers,
      todayTransfers,
      todayVolumeSendAmount: volumeByCurrency._sum.sendAmount,
      byStatus,
      pendingCount,
      cashAccounts: cashAccounts.map((c) => ({
        code: c.code,
        currency: c.currency,
        balance: c.balance,
        country: c.office.country.code,
      })),
      ledgerAccounts,
      income,
      auditRecent,
      totals,
    };
  }

  async auditLogs(query: { entity?: string; limit?: number }) {
    const where: any = {};
    if (query.entity) where.entity = query.entity;
    return this.prisma.auditLog.findMany({
      where,
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: Number(query.limit || 100),
    });
  }

  async listOffices() {
    return this.prisma.office.findMany({ include: { country: true, cashAccounts: true } });
  }

  async createOffice(data: { name: string; countryId: string; address?: string }) {
    return this.prisma.office.create({ data });
  }
}

function incomeByCurrency(entries: { amount: unknown; account: { currency: string } }[]) {
  const result: Record<string, number> = {};
  for (const e of entries) {
    result[e.account.currency] = (result[e.account.currency] ?? 0) + Number(e.amount);
  }
  return result;
}

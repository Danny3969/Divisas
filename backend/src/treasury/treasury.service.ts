import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TreasuryService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const [cashAccounts, bankAccounts, ledgerAccounts, pendingTransfers, recentSettlements] =
      await Promise.all([
        this.prisma.cashAccount.findMany({ include: { office: { include: { country: true } } } }),
        this.prisma.bankAccount.findMany({ include: { country: true } }),
        this.prisma.ledgerAccount.findMany(),
        this.prisma.transfer.findMany({
          where: { status: { in: ['SETTLEMENT_PENDING', 'PAYOUT_PROCESSING'] } },
          include: { sender: true, beneficiary: true },
          orderBy: { createdAt: 'asc' },
          take: 50,
        }),
        this.prisma.settlement.findMany({
          include: { transfer: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);

    return {
      cash: cashAccounts.map((c) => ({
        code: c.code,
        country: c.office.country.code,
        currency: c.currency,
        balance: c.balance,
      })),
      bank: bankAccounts.map((b) => ({
        bankName: b.bankName,
        country: b.country.code,
        currency: b.currency,
        accountName: b.accountName,
      })),
      ledger: ledgerAccounts,
      pendingTransfers,
      settlements: recentSettlements,
    };
  }

  async createSettlement(transferId: string, amount: number, currency: string) {
    return this.prisma.settlement.create({
      data: { transferId, amount, currency, status: 'COMPLETED', completedAt: new Date() },
    });
  }

  async listSettlements() {
    return this.prisma.settlement.findMany({ include: { transfer: true }, orderBy: { createdAt: 'desc' } });
  }
}

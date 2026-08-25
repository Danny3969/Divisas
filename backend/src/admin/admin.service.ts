import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, Role, TransferStatus } from '@prisma/client';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import * as bcrypt from 'bcryptjs';
import { AuthUser } from '../common/current-user.decorator';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async dashboard() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalTransfers,
      todayTransfers,
      byStatus,
      pendingCount,
      cashAccounts,
      ledgerAccounts,
      auditRecent,
      feeIncome,
      allTransfers,
    ] = await Promise.all([
      this.prisma.transfer.count(),
      this.prisma.transfer.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.transfer.groupBy({ by: ['status'], _count: true }),
      this.prisma.transfer.count({
        where: {
          status: {
            in: [
              TransferStatus.AWAITING_PAYMENT,
              TransferStatus.PAYMENT_RECEIVED,
              TransferStatus.MANUAL_REVIEW,
              TransferStatus.AML_REVIEW,
              TransferStatus.RISK_BLOCKED,
              TransferStatus.SETTLEMENT_PENDING,
              TransferStatus.PAYOUT_PROCESSING,
            ],
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
      this.prisma.transfer.findMany({
        select: {
          id: true,
          sendAmount: true,
          sendCurrency: true,
          receiveAmount: true,
          receiveCurrency: true,
          feeAmount: true,
          feeCurrency: true,
          paymentMethod: true,
          payoutMethod: true,
          status: true,
          createdAt: true,
          corridor: { select: { direction: true } },
        },
      }),
    ]);

    // Breakdown by payment method (Efectivo vs Transferencia Bancaria)
    const paymentBreakdown = {
      cash: { count: 0, totalUSD: 0, totalPEN: 0 },
      bank: { count: 0, totalUSD: 0, totalPEN: 0 },
    };

    // Breakdown by payout method (Efectivo vs Yape vs Banco)
    const payoutBreakdown = {
      cash: { count: 0, totalUSD: 0, totalPEN: 0 },
      yape: { count: 0, totalPEN: 0 },
      bank: { count: 0, totalUSD: 0, totalPEN: 0 },
    };

    // Total fees breakdown
    const feesBreakdown = {
      totalUSD: 0,
      totalPEN: 0,
      todayUSD: 0,
      todayPEN: 0,
    };

    // Volume by corridor
    const corridorVolume = {
      ecToPe: { count: 0, sendUSD: 0, receivePEN: 0 },
      peToEc: { count: 0, sendPEN: 0, receiveUSD: 0 },
    };

    for (const t of allTransfers) {
      const sendAmt = Number(t.sendAmount);
      const recAmt = Number(t.receiveAmount);
      const feeAmt = Number(t.feeAmount);
      const isToday = new Date(t.createdAt) >= todayStart;

      // Payment method
      if (t.paymentMethod === 'BANK_TRANSFER') {
        paymentBreakdown.bank.count++;
        if (t.sendCurrency === 'USD') paymentBreakdown.bank.totalUSD += sendAmt;
        else paymentBreakdown.bank.totalPEN += sendAmt;
      } else {
        paymentBreakdown.cash.count++;
        if (t.sendCurrency === 'USD') paymentBreakdown.cash.totalUSD += sendAmt;
        else paymentBreakdown.cash.totalPEN += sendAmt;
      }

      // Payout method
      if (t.payoutMethod === 'MOBILE_WALLET') {
        payoutBreakdown.yape.count++;
        payoutBreakdown.yape.totalPEN += recAmt;
      } else if (t.payoutMethod === 'BANK') {
        payoutBreakdown.bank.count++;
        if (t.receiveCurrency === 'USD') payoutBreakdown.bank.totalUSD += recAmt;
        else payoutBreakdown.bank.totalPEN += recAmt;
      } else {
        payoutBreakdown.cash.count++;
        if (t.receiveCurrency === 'USD') payoutBreakdown.cash.totalUSD += recAmt;
        else payoutBreakdown.cash.totalPEN += recAmt;
      }

      // Fees
      const feeCur = t.feeCurrency || t.sendCurrency;
      if (feeCur === 'USD') {
        feesBreakdown.totalUSD += feeAmt;
        if (isToday) feesBreakdown.todayUSD += feeAmt;
      } else {
        feesBreakdown.totalPEN += feeAmt;
        if (isToday) feesBreakdown.todayPEN += feeAmt;
      }

      // Corridor
      if (t.corridor?.direction === 'EC_TO_PE') {
        corridorVolume.ecToPe.count++;
        corridorVolume.ecToPe.sendUSD += sendAmt;
        corridorVolume.ecToPe.receivePEN += recAmt;
      } else if (t.corridor?.direction === 'PE_TO_EC') {
        corridorVolume.peToEc.count++;
        corridorVolume.peToEc.sendPEN += sendAmt;
        corridorVolume.peToEc.receiveUSD += recAmt;
      }
    }

    const volumeByCurrency = await this.prisma.transfer.aggregate({
      _sum: { sendAmount: true },
      where: { createdAt: { gte: todayStart } },
    });

    const income = incomeByCurrency(feeIncome);

    // Bank accounts from ledger (1010-EC, 1011-EC, 1010-PE)
    const bankAccounts = ledgerAccounts
      .filter((a) => a.code.startsWith('1010') || a.code.startsWith('1011'))
      .map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        currency: a.currency,
        balance: Number(a.balance),
      }));

    return {
      totalTransfers,
      todayTransfers,
      todayVolumeSendAmount: volumeByCurrency._sum.sendAmount,
      byStatus,
      pendingCount,
      paymentBreakdown,
      payoutBreakdown,
      feesBreakdown,
      corridorVolume,
      bankAccounts,
      cashAccounts: cashAccounts.map((c) => ({
        code: c.code,
        currency: c.currency,
        balance: Number(c.balance),
        country: c.office?.country?.code ?? 'EC',
      })),
      ledgerAccounts,
      income,
      auditRecent,
    };
  }

  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        officeId: true,
        office: { select: { id: true, name: true, country: { select: { code: true, name: true } } } },
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUser(dto: CreateUserDto, actor: AuthUser) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Ya existe un usuario con este correo electrónico');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        officeId: dto.officeId ?? null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        officeId: true,
        active: true,
        createdAt: true,
      },
    });

    await this.audit.record({
      actor,
      action: AuditAction.CREATE,
      entity: 'User',
      entityId: user.id,
      after: { email: user.email, role: user.role, fullName: user.fullName },
    });

    return user;
  }

  async updateUser(id: string, dto: UpdateUserDto, actor: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new BadRequestException('Ya existe otro usuario con este correo electrónico');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email ?? user.email,
        fullName: dto.fullName ?? user.fullName,
        phone: dto.phone !== undefined ? dto.phone : user.phone,
        role: dto.role ?? user.role,
        officeId: dto.officeId !== undefined ? dto.officeId : user.officeId,
        active: dto.active !== undefined ? dto.active : user.active,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        officeId: true,
        active: true,
      },
    });

    await this.audit.record({
      actor,
      action: AuditAction.UPDATE,
      entity: 'User',
      entityId: id,
      before: { role: user.role, active: user.active, email: user.email, fullName: user.fullName },
      after: { role: updated.role, active: updated.active, email: updated.email, fullName: updated.fullName },
    });

    return updated;
  }

  async deleteUser(id: string, actor: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (user.id === actor.userId) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta de administrador en sesión');
    }

    if (user.email === 'admin@divisas.com') {
      throw new BadRequestException('No se puede eliminar el administrador principal del sistema');
    }

    return this.prisma.$transaction(async (tx) => {
      // Desvincular customer si existe
      await tx.customer.updateMany({
        where: { userId: id },
        data: { userId: null },
      });

      // Eliminar logs de auditoría del usuario a eliminar
      await tx.auditLog.deleteMany({
        where: { actorId: id },
      });

      // Desvincular creador en otras tablas
      await tx.expense.updateMany({
        where: { createdById: id },
        data: { createdById: null },
      });
      await tx.accountTransfer.updateMany({
        where: { createdById: id },
        data: { createdById: null },
      });
      await tx.capitalMovement.updateMany({
        where: { createdById: id },
        data: { createdById: null },
      });
      await tx.payrollPayment.updateMany({
        where: { createdById: id },
        data: { createdById: null },
      });
      await tx.cashMovement.updateMany({
        where: { performedById: id },
        data: { performedById: null },
      });

      await tx.user.delete({ where: { id } });

      await this.audit.record({
        actor,
        action: AuditAction.DELETE,
        entity: 'User',
        entityId: id,
        before: { email: user.email, fullName: user.fullName, role: user.role },
      });

      return { success: true, message: `Usuario ${user.fullName} eliminado exitosamente.` };
    });
  }

  async resetUserPassword(id: string, newPassword: string, actor: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    await this.audit.record({
      actor,
      action: AuditAction.UPDATE,
      entity: 'User',
      entityId: id,
      after: { action: 'RESET_PASSWORD' },
    });

    return { success: true, message: 'Contraseña actualizada con éxito' };
  }

  /**
   * Limpia datos de prueba/ficticios conservando infraestructura inicial (países, corredores, oficinas y cuentas).
   */
  async resetDemoData(actor: AuthUser) {
    try {
      await this.prisma.paymentMatch.deleteMany({});
      await this.prisma.payment.deleteMany({});
      await this.prisma.payout.deleteMany({});
      await this.prisma.settlement.deleteMany({});
      await this.prisma.riskAssessment.deleteMany({});
      await this.prisma.transferEvent.deleteMany({});
      await this.prisma.ledgerEntry.deleteMany({});
      await this.prisma.transfer.deleteMany({});
      await this.prisma.quote.deleteMany({});
      await this.prisma.cashMovement.deleteMany({});
      await this.prisma.cashSession.deleteMany({});
      await this.prisma.bankTransaction.deleteMany({});
      await this.prisma.riskAlert.deleteMany({});
      await this.prisma.amlCase.deleteMany({});
      await this.prisma.document.deleteMany({});
      await this.prisma.beneficiaryAccount.deleteMany({});
      await this.prisma.beneficiary.deleteMany({});
      await this.prisma.customer.deleteMany({});
      await this.prisma.auditLog.deleteMany({});
      await this.prisma.user.deleteMany({ where: { email: { not: 'admin@divisas.com' } } });
      await this.prisma.cashAccount.updateMany({ data: { balance: 0 } });
      await this.prisma.ledgerAccount.updateMany({ data: { balance: 0 } });

      // Actualizar nombres de agencias a solo "Ecuador" y "Perú"
      await this.prisma.office.updateMany({ where: { country: { is: { code: 'EC' } } }, data: { name: 'Ecuador' } });
      await this.prisma.office.updateMany({ where: { country: { is: { code: 'PE' } } }, data: { name: 'Perú' } });

      await this.audit.record({
        actor,
        action: AuditAction.DELETE,
        entity: 'SystemData',
        entityId: 'reset-demo',
        after: { action: 'PURGE_FICTITIOUS_DATA' },
      });

      return { success: true, message: 'Datos ficticios eliminados correctamente. Sistema preparado para operaciones reales.' };
    } catch (error) {
      console.error('Error durante la depuración de datos ficticios:', error);
      throw new BadRequestException(
        `Error al limpiar datos: ${error instanceof Error ? error.message : 'Falló la eliminación de tablas vinculadas'}`
      );
    }
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

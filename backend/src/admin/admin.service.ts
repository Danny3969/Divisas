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

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName ?? user.fullName,
        role: dto.role ?? user.role,
        officeId: dto.officeId !== undefined ? dto.officeId : user.officeId,
        active: dto.active !== undefined ? dto.active : user.active,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
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
      before: { role: user.role, active: user.active },
      after: { role: updated.role, active: updated.active },
    });

    return updated;
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
    await this.prisma.$transaction([
      this.prisma.transferEvent.deleteMany({}),
      this.prisma.payment.deleteMany({}),
      this.prisma.payout.deleteMany({}),
      this.prisma.settlement.deleteMany({}),
      this.prisma.riskAssessment.deleteMany({}),
      this.prisma.riskAlert.deleteMany({}),
      this.prisma.amlCase.deleteMany({}),
      this.prisma.ledgerEntry.deleteMany({}),
      this.prisma.transfer.deleteMany({}),
      this.prisma.quote.deleteMany({}),
      this.prisma.cashMovement.deleteMany({}),
      this.prisma.cashSession.deleteMany({}),
      this.prisma.cashAccount.updateMany({ data: { balance: 0 } }),
    ]);

    await this.audit.record({
      actor,
      action: AuditAction.DELETE,
      entity: 'SystemData',
      entityId: 'reset-demo',
      after: { action: 'PURGE_FICTITIOUS_DATA' },
    });

    return { success: true, message: 'Datos ficticios eliminados. Sistema preparado para operaciones reales.' };
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

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenCashSessionDto, CloseCashSessionDto, CreateCashAccountDto } from './dto/cash.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/current-user.decorator';
import {
  AuditAction,
  CashMovementType,
  CashSessionStatus,
  LedgerAccountType,
  LedgerEntrySide,
} from '@prisma/client';

@Injectable()
export class CashService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async createCashAccount(dto: CreateCashAccountDto, actor: AuthUser) {
    const account = await this.prisma.cashAccount.create({ data: dto });
    await this.audit.record({ actor, action: AuditAction.CREATE, entity: 'CashAccount', entityId: account.id, after: dto });
    return account;
  }

  async listCashAccounts() {
    return this.prisma.cashAccount.findMany({
      include: { office: { include: { country: true } } },
    });
  }

  async openSession(dto: OpenCashSessionDto, actor: AuthUser) {
    const account = await this.prisma.cashAccount.findUnique({ where: { id: dto.cashAccountId } });
    if (!account) throw new NotFoundException('Cuenta de caja no encontrada');

    const open = await this.prisma.cashSession.findFirst({
      where: { cashAccountId: dto.cashAccountId, status: CashSessionStatus.OPEN },
    });
    if (open) throw new BadRequestException('Ya existe una sesión de caja abierta');

    const session = await this.prisma.$transaction(async (tx) => {
      const s = await tx.cashSession.create({
        data: {
          cashAccountId: dto.cashAccountId,
          openedById: actor.userId,
          openingBalance: dto.openingBalance,
        },
      });
      await tx.cashMovement.create({
        data: {
          cashAccountId: dto.cashAccountId,
          cashSessionId: s.id,
          type: CashMovementType.OPENING,
          amount: dto.openingBalance,
          currency: account.currency,
          description: 'Apertura de caja',
          performedById: actor.userId,
        },
      });
      await tx.cashAccount.update({
        where: { id: dto.cashAccountId },
        data: { balance: dto.openingBalance },
      });
      return s;
    });

    await this.audit.record({ actor, action: AuditAction.CASH_OPEN, entity: 'CashSession', entityId: session.id, after: dto });
    return session;
  }

  async closeSession(sessionId: string, dto: CloseCashSessionDto, actor: AuthUser) {
    const session = await this.prisma.cashSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Sesión de caja no encontrada');
    if (session.status !== CashSessionStatus.OPEN) {
      throw new BadRequestException('La sesión no está abierta');
    }

    const movements = await this.prisma.cashMovement.findMany({
      where: { cashSessionId: sessionId, type: { in: [CashMovementType.CASH_IN, CashMovementType.CASH_OUT, CashMovementType.ADJUSTMENT] } },
    });
    const expected =
      Number(session.openingBalance) +
      movements
        .filter((m) => m.type === CashMovementType.CASH_IN || m.type === CashMovementType.ADJUSTMENT)
        .reduce((a, m) => a + Number(m.amount), 0) -
      movements
        .filter((m) => m.type === CashMovementType.CASH_OUT)
        .reduce((a, m) => a + Number(m.amount), 0);

    const discrepancy = Math.round((expected - dto.actualBalance) * 100) / 100;
    const status =
      discrepancy === 0 ? CashSessionStatus.CLOSED : CashSessionStatus.PENDING_REVIEW;

    const closed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cashSession.update({
        where: { id: sessionId },
        data: {
          expectedBalance: expected,
          actualBalance: dto.actualBalance,
          discrepancy,
          status,
          closedById: actor.userId,
          closedAt: new Date(),
          note: dto.note,
        },
      });
      if (discrepancy !== 0) {
        await tx.cashMovement.create({
          data: {
            cashAccountId: session.cashAccountId,
            cashSessionId: sessionId,
            type: CashMovementType.ADJUSTMENT,
            amount: Math.abs(discrepancy),
            currency: (await this.prisma.cashAccount.findUnique({ where: { id: session.cashAccountId } }))?.currency ?? '',
            description: `Diferencia de caja: ${discrepancy > 0 ? 'sobrante' : 'faltante'} ${discrepancy}`,
            performedById: actor.userId,
          },
        });
      }
      // Recalcular balance real de la cuenta
      const all = await tx.cashMovement.findMany({ where: { cashAccountId: session.cashAccountId } });
      const balance = all.reduce((acc, m) => {
        if (m.type === CashMovementType.CASH_IN || m.type === CashMovementType.OPENING) return acc + Number(m.amount);
        if (m.type === CashMovementType.CASH_OUT) return acc - Number(m.amount);
        return acc;
      }, 0);
      await tx.cashAccount.update({ where: { id: session.cashAccountId }, data: { balance } });
      return updated;
    });

    await this.audit.record({
      actor,
      action: AuditAction.CASH_CLOSE,
      entity: 'CashSession',
      entityId: sessionId,
      before: { status: session.status },
      after: { status, expectedBalance: expected, discrepancy },
    });
    return closed;
  }

  async requireOpenSession(cashAccountId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { cashAccountId, status: CashSessionStatus.OPEN },
    });
    if (!session) {
      throw new BadRequestException('No hay una sesión de caja abierta para esta cuenta');
    }
    return session;
  }

  async getOpenSession(cashAccountId: string) {
    return this.prisma.cashSession.findFirst({
      where: { cashAccountId, status: CashSessionStatus.OPEN },
      include: { openedBy: true, movements: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
  }

  async listSessions(query: { status?: string; cashAccountId?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.cashAccountId) where.cashAccountId = query.cashAccountId;
    return this.prisma.cashSession.findMany({
      where,
      include: { cashAccount: { include: { office: true } }, openedBy: true, closedBy: true },
      orderBy: { openedAt: 'desc' },
      take: 100,
    });
  }

  async listMovements(cashAccountId: string) {
    return this.prisma.cashMovement.findMany({
      where: { cashAccountId },
      include: { performedBy: true, cashSession: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ===== Movimientos financieros (usados por payments/payouts) =====

  async applyCashMovement(params: {
    cashAccountId: string;
    sessionId: string;
    type: CashMovementType;
    amount: number;
    currency: string;
    description: string;
    actorId: string;
    actorRole?: string;
    transferId?: string;
  }) {
    const account = await this.prisma.cashAccount.findUnique({ where: { id: params.cashAccountId } });
    if (!account) throw new NotFoundException('Cuenta de caja no encontrada');

    // 1. Validar límite de seguridad de saldo máximo
    if (params.type === CashMovementType.CASH_IN && account.maxBalance) {
      const projectedBalance = Number(account.balance) + params.amount;
      if (projectedBalance > Number(account.maxBalance)) {
        throw new BadRequestException(
          `Operación rechazada: la caja superaría el saldo máximo de seguridad permitida (${account.maxBalance} ${account.currency}). Realice un traslado a bóveda.`,
        );
      }
    }

    // 2. Validar requerimiento de aprobación de supervisor para montos elevados
    if (account.requiresSupervisorAbove && params.amount > Number(account.requiresSupervisorAbove)) {
      if (params.actorRole && !['SUPERVISOR', 'ADMIN', 'TREASURY'].includes(params.actorRole)) {
        throw new BadRequestException(
          `Operación rechazada: los movimientos superiores a ${account.requiresSupervisorAbove} ${account.currency} requieren autorización de un SUPERVISOR.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.cashMovement.create({
        data: {
          cashAccountId: params.cashAccountId,
          cashSessionId: params.sessionId,
          type: params.type,
          amount: params.amount,
          currency: params.currency,
          description: params.description,
          performedById: params.actorId,
          transferId: params.transferId,
        },
      });

      const delta = params.type === CashMovementType.CASH_OUT ? -params.amount : params.amount;
      await tx.cashAccount.update({
        where: { id: params.cashAccountId },
        data: { balance: { increment: delta } },
      });
      return movement;
    });
  }
}

import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransferDto } from './dto/transfer.dto';
import { QuotesService } from '../quotes/quotes.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/current-user.decorator';
import {
  AuditAction,
  PayoutMethod,
  RiskAssessment,
  Role,
  Transfer,
  TransferStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

// Mapa de transiciones permitidas de la máquina de estados
const ALLOWED: Record<TransferStatus, TransferStatus[]> = {
  DRAFT: ['QUOTED', 'CANCELLED'],
  QUOTED: ['CONFIRMED', 'QUOTE_EXPIRED', 'CANCELLED'],
  CONFIRMED: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAYMENT_RECEIVED', 'PAYMENT_EXPIRED', 'PAYMENT_MISMATCH', 'CANCELLED'],
  PAYMENT_MISMATCH: ['MANUAL_REVIEW', 'CANCELLED'],
  PAYMENT_RECEIVED: ['RECONCILIATION'],
  RECONCILIATION: ['RISK_CHECK', 'MANUAL_REVIEW', 'PAYMENT_MISMATCH'],
  RISK_CHECK: ['APPROVED', 'MANUAL_REVIEW', 'AML_REVIEW', 'RISK_BLOCKED'],
  MANUAL_REVIEW: ['APPROVED', 'RISK_BLOCKED', 'REFUND_PENDING', 'CANCELLED'],
  AML_REVIEW: ['APPROVED', 'RISK_BLOCKED', 'REFUND_PENDING'],
  RISK_BLOCKED: ['REFUND_PENDING', 'SETTLEMENT_PENDING'],
  APPROVED: ['SETTLEMENT_PENDING'],
  SETTLEMENT_PENDING: ['PAYOUT_PROCESSING', 'PAYOUT_FAILED', 'RISK_BLOCKED'],
  PAYOUT_PROCESSING: ['PAID', 'PAYOUT_FAILED', 'PAYOUT_REJECTED'],
  PAYOUT_FAILED: ['PAYOUT_PROCESSING', 'PAYOUT_REJECTED'],
  PAYOUT_REJECTED: ['PAYOUT_PROCESSING', 'REFUND_PENDING'],
  PAID: ['COMPLETED'],
  COMPLETED: [],
  QUOTE_EXPIRED: ['QUOTED'],
  REFUND_PENDING: ['REFUNDED'],
  PAYMENT_EXPIRED: ['CANCELLED', 'AWAITING_PAYMENT'],
  CANCELLED: [],
  REFUNDED: [],
};

// Exportada para pruebas automatizadas (máquina de estados pura)
export const TRANSFER_STATE_MACHINE: Record<TransferStatus, TransferStatus[]> = ALLOWED;

export function makeTransferReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = '';
  const bytes = crypto.randomBytes(8);
  for (const b of bytes) ref += alphabet[b % alphabet.length];
  return `TRX-${ref}`;
}

export function makeWithdrawalCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (n: number) => {
    let s = '';
    const bytes = crypto.randomBytes(n);
    for (const b of bytes) s += alphabet[b % alphabet.length];
    return s;
  };
  return `VLX-${pick(4)}-${pick(4)}`;
}

@Injectable()
export class TransfersService {
  constructor(
    private prisma: PrismaService,
    private quotes: QuotesService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateTransferDto, actor: AuthUser) {
    if (dto.payoutMethod === PayoutMethod.BANK && !dto.payoutAccountId) {
      throw new BadRequestException('Payout por banco requiere una cuenta de beneficiario');
    }

    const quote = await this.quotes.findActive(dto.quoteId);

    // Validar que el remitente sea el cliente indicado
    if (quote.corridorId) {
      const sender = await this.prisma.customer.findUnique({ where: { id: dto.senderCustomerId } });
      if (!sender) throw new NotFoundException('Cliente no encontrado');
      if (actor.role === Role.CUSTOMER && sender.userId !== actor.userId) {
        throw new ForbiddenException('Solo puede operar con su propio perfil');
      }
    }

    const beneficiary = await this.prisma.beneficiary.findUnique({ where: { id: dto.beneficiaryId } });
    if (!beneficiary) throw new NotFoundException('Beneficiario no encontrado');
    if (actor.role === Role.CUSTOMER && beneficiary.customerId !== dto.senderCustomerId) {
      throw new BadRequestException('El beneficiario no pertenece al cliente');
    }

    const withdrawalCode = makeWithdrawalCode();

    const transfer = await this.prisma.$transaction(async (tx) => {
      await tx.quote.update({ where: { id: quote.id }, data: { status: 'USED' } });

      const created = await tx.transfer.create({
        data: {
          reference: makeTransferReference(),
          status: TransferStatus.CONFIRMED,
          corridorId: quote.corridorId,
          senderId: dto.senderCustomerId,
          beneficiaryId: dto.beneficiaryId,
          payoutMethod: dto.payoutMethod,
          paymentMethod: dto.paymentMethod,
          quoteId: quote.id,
          sendAmount: quote.sendAmount,
          sendCurrency: quote.sendCurrency,
          feeAmount: quote.feeAmount,
          feeCurrency: quote.feeCurrency,
          fxRate: quote.fxRate,
          receiveAmount: quote.receiveAmount,
          receiveCurrency: quote.receiveCurrency,
          payoutAccountId: dto.payoutAccountId ?? null,
          remittanceReason: dto.remittanceReason ?? null,
          withdrawalCode,
          withdrawalExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días de vigencia
        },
      });

      // Evaluación de riesgo determinística
      const risk = this.evaluateRisk(created, beneficiary);
      await tx.riskAssessment.create({
        data: {
          transferId: created.id,
          score: risk.score,
          level: risk.level,
          reasons: risk.reasons as any,
        },
      });
      await tx.transfer.update({ where: { id: created.id }, data: { riskScore: risk.score } });

      await tx.transferEvent.create({
        data: { transferId: created.id, toStatus: TransferStatus.CONFIRMED, actorId: actor.userId },
      });

      return created;
    });

    await this.audit.record({
      actor,
      action: AuditAction.CREATE,
      entity: 'Transfer',
      entityId: transfer.id,
      after: { reference: transfer.reference, status: transfer.status },
    });
    return this.findOne(transfer.id);
  }

  private evaluateRisk(
    transfer: Transfer,
    beneficiary: { id: string; createdAt: Date },
  ): { score: number; level: string; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const amount = Number(transfer.receiveAmount);

    if (amount > 5000) {
      score += 40;
      reasons.push('Monto superior a 5000 moneda destino');
    } else if (amount > 2000) {
      score += 20;
      reasons.push('Monto entre 2000 y 5000');
    }

    if (beneficiary.createdAt.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000) {
      score += 15;
      reasons.push('Beneficiario reciente');
    }

    if (transfer.payoutMethod === PayoutMethod.CASH) {
      score += 5;
      reasons.push('Payout en efectivo');
    }

    const level = score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW';
    return { score, level, reasons };
  }

  async transition(id: string, toStatus: TransferStatus, actor: AuthUser, note?: string) {
    const transfer = await this.prisma.transfer.findUnique({ where: { id } });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada');

    const allowed = ALLOWED[transfer.status];
    if (!allowed || !allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Transición no permitida: ${transfer.status} → ${toStatus}`,
      );
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const next = await tx.transfer.update({
          where: { id, status: transfer.status },
          data: { status: toStatus },
        });
        await tx.transferEvent.create({
          data: {
            transferId: id,
            fromStatus: transfer.status,
            toStatus,
            actorId: actor.userId,
            note,
          },
        });
        return next;
      });

      await this.audit.record({
        actor,
        action: AuditAction.STATUS_CHANGE,
        entity: 'Transfer',
        entityId: id,
        before: { status: transfer.status },
        after: { status: toStatus },
      });
      return updated;
    } catch (err) {
      if (err.code === 'P2025') {
        throw new BadRequestException(
          'La transferencia ya cambió de estado o fue modificada por otra operación concurrente.',
        );
      }
      throw err;
    }

  }

  async findOne(id: string, actor?: AuthUser) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: {
        corridor: { include: { fromCountry: true, toCountry: true } },
        sender: true,
        beneficiary: { include: { accounts: true } },
        quote: true,
        payoutAccount: true,
        events: { orderBy: { createdAt: 'asc' } },
        payments: true,
        payouts: true,
        settlements: true,
        riskAssessments: true,
      },
    });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada');
    if (actor?.role === Role.CUSTOMER) {
      const sender = await this.prisma.customer.findUnique({ where: { id: transfer.senderId } });
      if (!sender || sender.userId !== actor.userId) {
        throw new NotFoundException('Transferencia no encontrada');
      }
    }
    return transfer;
  }

  async listMine(userId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) return [];
    return this.prisma.transfer.findMany({
      where: { senderId: customer.id },
      include: {
        corridor: { include: { fromCountry: true, toCountry: true } },
        beneficiary: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findByReference(reference: string) {
    const transfer = await this.prisma.transfer.findUnique({ where: { reference } });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada');
    return this.findOne(transfer.id);
  }

  async list(query: {
    search?: string;
    status?: string;
    senderId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.senderId) where.senderId = query.senderId;
    if (query.search) {
      where.OR = [
        { reference: { contains: query.search } },
        { sender: { is: { fullName: { contains: query.search, mode: 'insensitive' } } } },
        { beneficiary: { is: { fullName: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.transfer.findMany({
        where,
        include: {
          corridor: { include: { fromCountry: true, toCountry: true } },
          sender: true,
          beneficiary: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transfer.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /**
   * Regenera el código de retiro cuando una operación fue bloqueada por 3 intentos fallidos o requerida por Admin.
   */
  async regenerateWithdrawalCode(id: string, actor: AuthUser) {
    if (actor.role !== Role.ADMIN && actor.role !== Role.SUPERVISOR) {
      throw new ForbiddenException('Solo un Administrador o Supervisor puede regenerar códigos de retiro');
    }
    const transfer = await this.prisma.transfer.findUnique({ where: { id } });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada');
    if (transfer.payoutMethod !== PayoutMethod.CASH) {
      throw new BadRequestException('Solo las operaciones con retiro en efectivo tienen código');
    }

    const newCode = makeWithdrawalCode();
    const updated = await this.prisma.transfer.update({
      where: { id },
      data: {
        withdrawalCode: newCode,
        withdrawalAttempts: 0,
        withdrawalExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días de vigencia
        status: transfer.status === TransferStatus.RISK_BLOCKED ? TransferStatus.SETTLEMENT_PENDING : transfer.status,
      },
    });

    await this.prisma.transferEvent.create({
      data: {
        transferId: id,
        fromStatus: transfer.status,
        toStatus: updated.status,
        actorId: actor.userId,
        note: `Código de retiro regenerado por ${actor.role}. Nuevo código emitido: ${newCode}`,
      },
    });

    await this.audit.record({
      actor,
      action: AuditAction.APPROVE,
      entity: 'Transfer',
      entityId: id,
      after: { action: 'REGENERATE_CODE', newCode },
    });

    return this.findOne(id);
  }

  /**
   * Genera el mensaje y enlace oficial de WhatsApp para notificar al beneficiario.
   */
  async getWhatsappLink(id: string) {
    const transfer = await this.findOne(id);
    if (!transfer.withdrawalCode) {
      throw new BadRequestException('La operación no tiene código de retiro generado');
    }

    const text = `*VALEX — GIROS & DIVISAS*\n\nHola *${transfer.beneficiary.fullName}*,\n\n*${transfer.sender.fullName}* te ha enviado un giro por *${transfer.receiveAmount} ${transfer.receiveCurrency}*.\n\nPuedes retirarlo en cualquier oficina de VALEX presentando tu documento y el siguiente código:\n\n🔑 *Código de Retiro:* ${transfer.withdrawalCode}\n\nVigencia: 30 días. ¡Gracias por confiar en VALEX!`;
    const encoded = encodeURIComponent(text);
    const phoneClean = transfer.beneficiary.phone ? transfer.beneficiary.phone.replace(/\D/g, '') : '';
    const link = phoneClean ? `https://wa.me/${phoneClean}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    return { text, link, phone: transfer.beneficiary.phone };
  }
}

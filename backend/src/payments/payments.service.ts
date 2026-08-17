import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransfersService } from '../transfers/transfers.service';
import { CashService } from '../cash/cash.service';
import { LedgerService } from '../ledger/ledger.service';
import { RegisterCashPaymentDto, RegisterBankPaymentDto } from './dto/payment.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/current-user.decorator';
import {
  AuditAction,
  CashMovementType,
  LedgerEntrySide,
  PaymentMethod,
  PaymentStatus,
  TransferStatus,
} from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private transfers: TransfersService,
    private cash: CashService,
    private ledger: LedgerService,
    private audit: AuditService,
  ) {}

  /**
   * CASH-IN: el cliente entrega efectivo en la oficina origen.
   * La operación ya existe (CONFIRMED o AWAITING_PAYMENT); aquí se registra la recepción.
   */
  async registerCashPayment(dto: RegisterCashPaymentDto, actor: AuthUser) {
    const transfer = await this.prisma.transfer.findUnique({ where: { id: dto.transferId } });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada');
    if (transfer.paymentMethod !== PaymentMethod.CASH) {
      throw new BadRequestException('La transferencia no usa pago en efectivo');
    }
    if (transfer.status !== TransferStatus.AWAITING_PAYMENT && transfer.status !== TransferStatus.CONFIRMED) {
      throw new BadRequestException(`Estado ${transfer.status} no permite registrar efectivo`);
    }
    if (transfer.status === TransferStatus.CONFIRMED) {
      await this.transfers.transition(transfer.id, TransferStatus.AWAITING_PAYMENT, actor, 'Preparando pago en efectivo');
    }

    const cashAccount = await this.prisma.cashAccount.findUnique({
      where: { id: dto.cashAccountId },
      include: { office: { include: { country: true } } },
    });
    if (!cashAccount) throw new NotFoundException('Cuenta de caja no encontrada');

    const session = await this.cash.requireOpenSession(dto.cashAccountId);

    // El monto en efectivo es el monto enviado (send amount)
    const amount = Number(transfer.sendAmount);
    const currency = transfer.sendCurrency;

    const movement = await this.cash.applyCashMovement({
      cashAccountId: dto.cashAccountId,
      sessionId: session.id,
      type: CashMovementType.CASH_IN,
      amount,
      currency,
      description: `CASH-IN transferencia ${transfer.reference}`,
      actorId: actor.userId,
      transferId: transfer.id,
    });

    const payment = await this.prisma.payment.create({
      data: {
        transferId: transfer.id,
        method: PaymentMethod.CASH,
        status: PaymentStatus.MATCHED, // el efectivo se concilia al instante
        amount,
        currency,
        cashMovementId: movement.id,
        receivedById: actor.userId,
        receivedAt: new Date(),
        referenceCode: dto.referenceCode,
        sourceOfFunds: dto.sourceOfFunds ?? null,
        highBillSerials: dto.highBillSerials ?? null,
      },
    });

    // Ledger: DEBIT caja origen (USD/PEN), CREDIT pasivo origen, CREDIT ingreso por comisión
    const countryCode = cashAccount.office.country.code;
    const netSend = amount - Number(transfer.feeAmount);
    await this.ledger.postDoubleEntry({
      entryGroup: `${transfer.reference}-CASHIN`,
      transferId: transfer.id,
      actor,
      entries: [
        {
          accountId: (await this.ledger.mustGetAccountByCode(`1020-${countryCode}`)).id,
          side: LedgerEntrySide.DEBIT,
          amount,
          currency,
          description: `Recepción de efectivo ${transfer.reference}`,
        },
        {
          accountId: (await this.ledger.mustGetAccountByCode(`2030-${countryCode}`)).id,
          side: LedgerEntrySide.CREDIT,
          amount: netSend,
          currency,
          description: `Pasivo remesa ${transfer.reference}`,
        },
        {
          accountId: (await this.ledger.mustGetAccountByCode(transfer.feeCurrency === 'USD' ? '4010' : '4011')).id,
          side: LedgerEntrySide.CREDIT,
          amount: Number(transfer.feeAmount),
          currency: transfer.feeCurrency,
          description: `Comisión ${transfer.reference}`,
        },
      ],
    });

    await this.audit.record({
      actor,
      action: AuditAction.CASH_IN,
      entity: 'Payment',
      entityId: payment.id,
      after: { transferId: transfer.id, amount, currency, cashMovementId: movement.id },
    });

    return this.autoProcessAfterPayment(transfer.id, actor);
  }

  /**
   * Pago por transferencia bancaria: registra el pago pendiente (PENDING).
   */
  async registerBankPayment(dto: RegisterBankPaymentDto, actor: AuthUser) {
    const transfer = await this.prisma.transfer.findUnique({ where: { id: dto.transferId } });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada');
    if (transfer.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
      throw new BadRequestException('La transferencia no usa pago bancario');
    }
    if (transfer.status !== TransferStatus.AWAITING_PAYMENT && transfer.status !== TransferStatus.CONFIRMED) {
      throw new BadRequestException(`Estado ${transfer.status} no permite registrar pago bancario`);
    }
    if (transfer.status === TransferStatus.CONFIRMED) {
      await this.transfers.transition(transfer.id, TransferStatus.AWAITING_PAYMENT, actor, 'Esperando pago bancario');
    }

    const payment = await this.prisma.payment.create({
      data: {
        transferId: transfer.id,
        method: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.PENDING,
        amount: dto.amount,
        currency: dto.currency,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        transactionRef: dto.transactionRef,
        sourceOfFunds: dto.sourceOfFunds ?? null,
      },
    });

    await this.audit.record({
      actor,
      action: AuditAction.CREATE,
      entity: 'Payment',
      entityId: payment.id,
      after: { transferId: transfer.id, amount: dto.amount, status: PaymentStatus.PENDING },
    });
    return payment;
  }

  /**
   * Confirmación/conciliación del pago bancario (sandbox de banco).
   */
  async confirmBankPayment(paymentId: string, actor: AuthUser, detail?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    const transfer = await this.prisma.transfer.findUnique({ where: { id: payment.transferId } });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada');

    const paymentMatch = await this.prisma.paymentMatch.create({
      data: {
        paymentId,
        matched: true,
        matchType: 'BANK_STATEMENT',
        detail: detail ?? 'Conciliado (sandbox bancario)',
      },
    });

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.MATCHED, receivedAt: new Date() },
    });

    await this.audit.record({
      actor,
      action: AuditAction.PAYMENT_MATCH,
      entity: 'Payment',
      entityId: paymentId,
      after: { matchType: 'BANK_STATEMENT' },
    });

    await this.transfers.transition(transfer.id, TransferStatus.PAYMENT_RECEIVED, actor, 'Pago bancario conciliado');

    // Ledger: DEBIT banco origen, CREDIT pasivo origen
    const corridor = await this.prisma.corridor.findUnique({
      where: { id: transfer.corridorId },
      include: { fromCountry: true },
    });
    if (!corridor) throw new NotFoundException('Corredor no encontrado');
    const countryCode = corridor.fromCountry.code;
    const amount = Number(payment.amount);
    const netSend = amount - Number(transfer.feeAmount);
    await this.ledger.postDoubleEntry({
      entryGroup: `${transfer.reference}-BANKPAY`,
      transferId: transfer.id,
      actor,
      entries: [
        {
          accountId: (await this.ledger.mustGetAccountByCode(`1010-${countryCode}`)).id,
          side: LedgerEntrySide.DEBIT,
          amount,
          currency: payment.currency,
          description: `Abono bancario ${transfer.reference}`,
        },
        {
          accountId: (await this.ledger.mustGetAccountByCode(`2030-${countryCode}`)).id,
          side: LedgerEntrySide.CREDIT,
          amount: netSend,
          currency: payment.currency,
          description: `Pasivo remesa ${transfer.reference}`,
        },
        {
          accountId: (await this.ledger.mustGetAccountByCode(payment.currency === 'USD' ? '4010' : '4011')).id,
          side: LedgerEntrySide.CREDIT,
          amount: Number(transfer.feeAmount),
          currency: transfer.feeCurrency,
          description: `Comisión ${transfer.reference}`,
        },
      ],
    });

    return this.autoProcessAfterPayment(transfer.id, actor);
  }

  /**
   * Procesamiento automático tras recibir el pago:
   * PAYMENT_RECEIVED → RECONCILIATION → RISK_CHECK → APPROVED | MANUAL_REVIEW → SETTLEMENT_PENDING
   */
  async autoProcessAfterPayment(transferId: string, actor: AuthUser) {
    const fresh = async () =>
      this.prisma.transfer.findUnique({
        where: { id: transferId },
        include: { riskAssessments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });

    let transfer = await fresh();
    if (!transfer) throw new NotFoundException('Transferencia no encontrada');

    if (transfer.status === TransferStatus.AWAITING_PAYMENT) {
      await this.transfers.transition(transferId, TransferStatus.PAYMENT_RECEIVED, actor, 'Pago recibido');
      transfer = await fresh();
    }
    if (transfer?.status === TransferStatus.PAYMENT_RECEIVED) {
      await this.transfers.transition(transferId, TransferStatus.RECONCILIATION, actor, 'Conciliando pago');
      await this.transfers.transition(transferId, TransferStatus.RISK_CHECK, actor, 'Evaluación de riesgo');
      transfer = await fresh();
    }

    const risk = transfer?.riskAssessments?.[0];
    if (transfer?.status === TransferStatus.RISK_CHECK) {
      if (risk && risk.level !== 'LOW') {
        await this.transfers.transition(
          transferId,
          risk.level === 'HIGH' ? TransferStatus.AML_REVIEW : TransferStatus.MANUAL_REVIEW,
          actor,
          `Riesgo ${risk.level}`,
        );
      } else {
        await this.transfers.transition(transferId, TransferStatus.APPROVED, actor, 'Riesgo bajo, aprobada');
      }
      transfer = await fresh();
    }

    if (transfer?.status === TransferStatus.APPROVED) {
      await this.transfers.transition(transferId, TransferStatus.SETTLEMENT_PENDING, actor, 'Preparando liquidación');
    }

    return this.transfers.findOne(transferId);
  }

  async listByTransfer(transferId: string) {
    return this.prisma.payment.findMany({
      where: { transferId },
      include: { matches: true, cashMovement: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}

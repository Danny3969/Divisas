import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransfersService } from '../transfers/transfers.service';
import { CashService } from '../cash/cash.service';
import { LedgerService } from '../ledger/ledger.service';
import { ProcessCashOutDto, ProcessBankPayoutDto } from './dto/payout.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/current-user.decorator';
import {
  AuditAction,
  CashMovementType,
  LedgerEntrySide,
  PayoutMethod,
  PayoutStatus,
  TransferStatus,
} from '@prisma/client';

@Injectable()
export class PayoutsService {
  constructor(
    private prisma: PrismaService,
    private transfers: TransfersService,
    private cash: CashService,
    private ledger: LedgerService,
    private audit: AuditService,
  ) {}

  /**
   * Validación del código de retiro (para la pantalla VALIDAR del cajero).
   */
  async validateWithdrawalCode(code: string) {
    const transfer = await this.prisma.transfer.findFirst({
      where: { withdrawalCode: code },
      include: {
        beneficiary: { include: { accounts: true } },
        corridor: { include: { toCountry: true } },
      },
    });
    if (!transfer) throw new NotFoundException('Código de retiro inválido');
    if (transfer.withdrawalUsed) throw new BadRequestException('El código de retiro ya fue utilizado');
    if (transfer.withdrawalExpiresAt && new Date(transfer.withdrawalExpiresAt) < new Date()) {
      throw new BadRequestException('El código de retiro expiró');
    }
    if (transfer.status !== TransferStatus.SETTLEMENT_PENDING && transfer.status !== TransferStatus.PAYOUT_PROCESSING) {
      throw new BadRequestException(`La transferencia no está lista para retiro (${transfer.status})`);
    }
    return transfer;
  }

  /**
   * CASH OUT: entrega de efectivo en oficina destino con validaciones completas.
   */
  async processCashOut(dto: ProcessCashOutDto, actor: AuthUser) {
    const transfer = await this.validateWithdrawalCode(dto.withdrawalCode);
    if (transfer.id !== dto.transferId) {
      throw new BadRequestException('El código no corresponde a la transferencia');
    }
    if (transfer.payoutMethod !== PayoutMethod.CASH) {
      throw new BadRequestException('La transferencia no usa retiro en efectivo');
    }

    // Verificación del documento del beneficiario (identidad en ventanilla)
    if (transfer.beneficiary.documentNumber !== dto.beneficiaryDocument) {
      // Incrementa intentos y registra auditoría
      await this.prisma.transfer.update({
        where: { id: transfer.id },
        data: { withdrawalAttempts: { increment: 1 } },
      });
      await this.audit.record({
        actor,
        action: AuditAction.BLOCK,
        entity: 'Transfer',
        entityId: transfer.id,
        after: { reason: 'DOCUMENT_MISMATCH' },
      });
      throw new BadRequestException('El documento no coincide con el beneficiario');
    }

    const cashAccount = await this.prisma.cashAccount.findUnique({
      where: { id: dto.cashAccountId },
      include: { office: { include: { country: true } } },
    });
    if (!cashAccount) throw new NotFoundException('Cuenta de caja no encontrada');

    const session = await this.cash.requireOpenSession(dto.cashAccountId);
    const amount = Number(transfer.receiveAmount);
    const currency = transfer.receiveCurrency;

    // Validar saldo suficiente de caja
    if (Number(cashAccount.balance) < amount) {
      throw new BadRequestException('Saldo de caja insuficiente');
    }

    if (transfer.status === TransferStatus.SETTLEMENT_PENDING) {
      await this.transfers.transition(transfer.id, TransferStatus.PAYOUT_PROCESSING, actor, 'Iniciando cash-out');
    }

    const movement = await this.cash.applyCashMovement({
      cashAccountId: dto.cashAccountId,
      sessionId: session.id,
      type: CashMovementType.CASH_OUT,
      amount,
      currency,
      description: `CASH-OUT retiro ${transfer.reference}`,
      actorId: actor.userId,
      transferId: transfer.id,
    });

    const payout = await this.prisma.payout.create({
      data: {
        transferId: transfer.id,
        method: PayoutMethod.CASH,
        status: PayoutStatus.PAID,
        amount,
        currency,
        cashMovementId: movement.id,
        processedById: actor.userId,
        processedAt: new Date(),
        pickupAt: new Date(),
      },
    });

    // Invalidar código + cerrar transferencia
    await this.prisma.transfer.update({
      where: { id: transfer.id },
      data: { withdrawalUsed: true },
    });
    await this.transfers.transition(transfer.id, TransferStatus.PAID, actor, 'Beneficiario pagado en ventanilla');
    await this.transfers.transition(transfer.id, TransferStatus.COMPLETED, actor, 'Operación completada');

    // Ledger: DEBIT pasivo destino, CREDIT caja destino
    const countryCode = cashAccount.office.country.code;
    await this.ledger.postDoubleEntry({
      entryGroup: `${transfer.reference}-CASHOUT`,
      transferId: transfer.id,
      actor,
      entries: [
        {
          accountId: (await this.ledger.mustGetAccountByCode(`2030-${countryCode}`)).id,
          side: LedgerEntrySide.DEBIT,
          amount,
          currency,
          description: `Cierre pasivo retiro ${transfer.reference}`,
        },
        {
          accountId: (await this.ledger.mustGetAccountByCode(`1020-${countryCode}`)).id,
          side: LedgerEntrySide.CREDIT,
          amount,
          currency,
          description: `Entrega de efectivo ${transfer.reference}`,
        },
      ],
    });

    await this.audit.record({
      actor,
      action: AuditAction.CASH_OUT,
      entity: 'Payout',
      entityId: payout.id,
      after: { transferId: transfer.id, amount, currency },
    });

    return this.transfers.findOne(transfer.id);
  }

  /**
   * Payout bancario (simulado con sandbox de banco).
   */
  async processBankPayout(dto: ProcessBankPayoutDto, actor: AuthUser) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: dto.transferId },
      include: { payoutAccount: true, corridor: { include: { toCountry: true } } },
    });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada');
    if (transfer.payoutMethod !== PayoutMethod.BANK) {
      throw new BadRequestException('La transferencia no usa payout bancario');
    }
    if (transfer.status !== TransferStatus.SETTLEMENT_PENDING && transfer.status !== TransferStatus.PAYOUT_PROCESSING) {
      throw new BadRequestException(`Estado ${transfer.status} no permite payout bancario`);
    }

    if (transfer.status === TransferStatus.SETTLEMENT_PENDING) {
      await this.transfers.transition(transfer.id, TransferStatus.PAYOUT_PROCESSING, actor, 'Iniciando payout bancario');
    }

    const payout = await this.prisma.payout.create({
      data: {
        transferId: transfer.id,
        method: PayoutMethod.BANK,
        status: PayoutStatus.PROCESSING,
        amount: Number(transfer.receiveAmount),
        currency: transfer.receiveCurrency,
        bankName: transfer.payoutAccount?.bankName ?? 'Banco destino',
        accountNumber: transfer.payoutAccount?.accountNumber ?? null,
      },
    });

    // Simulación de transferencia bancaria (BANK SANDBOX)
    await this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: PayoutStatus.PAID,
        bankRef: `BANK-${payout.id.slice(0, 8).toUpperCase()}`,
        processedById: actor.userId,
        processedAt: new Date(),
      },
    });

    await this.transfers.transition(transfer.id, TransferStatus.PAID, actor, 'Payout bancario ejecutado');
    await this.transfers.transition(transfer.id, TransferStatus.COMPLETED, actor, 'Operación completada');

    // Ledger: DEBIT pasivo destino, CREDIT banco destino
    const countryCode = transfer.corridor.toCountry.code;
    const amount = Number(transfer.receiveAmount);
    const currency = transfer.receiveCurrency;
    await this.ledger.postDoubleEntry({
      entryGroup: `${transfer.reference}-BANKPAYOUT`,
      transferId: transfer.id,
      actor,
      entries: [
        {
          accountId: (await this.ledger.mustGetAccountByCode(`2030-${countryCode}`)).id,
          side: LedgerEntrySide.DEBIT,
          amount,
          currency,
          description: `Cierre pasivo payout ${transfer.reference}`,
        },
        {
          accountId: (await this.ledger.mustGetAccountByCode(`1010-${countryCode}`)).id,
          side: LedgerEntrySide.CREDIT,
          amount,
          currency,
          description: `Transferencia bancaria ${transfer.reference}`,
        },
      ],
    });

    await this.audit.record({
      actor,
      action: AuditAction.PAYOUT,
      entity: 'Payout',
      entityId: payout.id,
      after: { transferId: transfer.id, amount, currency, method: 'BANK' },
    });

    return this.transfers.findOne(transfer.id);
  }

  async listByTransfer(transferId: string) {
    return this.prisma.payout.findMany({
      where: { transferId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

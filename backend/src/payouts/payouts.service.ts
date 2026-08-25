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
        payoutAccount: true,
      },
    });
    if (!transfer) throw new NotFoundException('Código de retiro inválido');
    if (transfer.status === TransferStatus.RISK_BLOCKED) {
      throw new BadRequestException('La operación se encuentra BLOQUEADA por 3 intentos fallidos. El Administrador debe regenerar el código.');
    }
    if (transfer.withdrawalUsed) throw new BadRequestException('El código de retiro ya fue utilizado');
    if (transfer.withdrawalExpiresAt && new Date(transfer.withdrawalExpiresAt) < new Date()) {
      throw new BadRequestException('El código de retiro ha caducado tras 30 días de vigencia');
    }
    if (transfer.status !== TransferStatus.SETTLEMENT_PENDING && transfer.status !== TransferStatus.PAYOUT_PROCESSING) {
      throw new BadRequestException(`La transferencia no está lista para retiro (${transfer.status})`);
    }
    return transfer;
  }

  /**
   * Payout / Cancelación y Entrega de Fondos:
   * Soporta Retiro en Efectivo (Ventanilla), Abono Yape y Transferencia Bancaria.
   */
  async processCashOut(dto: ProcessCashOutDto, actor: AuthUser) {
    const transfer = await this.validateWithdrawalCode(dto.withdrawalCode);
    if (transfer.id !== dto.transferId) {
      throw new BadRequestException('El Código Único de VALEX no corresponde a esta transferencia');
    }

    if (transfer.withdrawalUsed || transfer.status === TransferStatus.COMPLETED || transfer.status === TransferStatus.PAID) {
      throw new BadRequestException('Esta transferencia ya fue CANCELADA / PAGADA y los fondos ya fueron entregados.');
    }

    const corridor = await this.prisma.corridor.findUnique({
      where: { id: transfer.corridorId },
      include: { toCountry: true },
    });
    const countryCode = corridor?.toCountry.code || 'PE';
    const amount = Number(transfer.receiveAmount);
    const currency = transfer.receiveCurrency;

    // 1. Verificación del documento del beneficiario si aplica
    if (
      dto.beneficiaryDocument &&
      transfer.beneficiary.documentNumber &&
      transfer.beneficiary.documentNumber !== '00000000' &&
      dto.beneficiaryDocument !== '00000000' &&
      transfer.beneficiary.documentNumber.trim() !== dto.beneficiaryDocument.trim()
    ) {
      const nextAttempts = transfer.withdrawalAttempts + 1;
      const isBlocked = nextAttempts >= 3;

      await this.prisma.transfer.update({
        where: { id: transfer.id },
        data: {
          withdrawalAttempts: nextAttempts,
          status: isBlocked ? TransferStatus.RISK_BLOCKED : transfer.status,
        },
      });

      await this.prisma.transferEvent.create({
        data: {
          transferId: transfer.id,
          fromStatus: transfer.status,
          toStatus: isBlocked ? TransferStatus.RISK_BLOCKED : transfer.status,
          actorId: actor.userId,
          note: isBlocked
            ? `BLOQUEO DE SEGURIDAD: 3 intentos fallidos de retiro con documento ${dto.beneficiaryDocument}`
            : `Intento fallido de retiro (${nextAttempts}/3) con documento ${dto.beneficiaryDocument}`,
        },
      });

      if (isBlocked) {
        throw new BadRequestException(
          'Operación BLOQUEADA por seguridad tras 3 intentos fallidos de documento. Notifique al Administrador.',
        );
      }
      throw new BadRequestException(`El documento no coincide con el beneficiario. Intento ${nextAttempts}/3`);
    }

    if (transfer.status === TransferStatus.SETTLEMENT_PENDING) {
      await this.transfers.transition(transfer.id, TransferStatus.PAYOUT_PROCESSING, actor, 'Procesando entrega');
    }

    let cashMovementId: string | null = null;

    // 2. Proceso según la Forma de Entrega
    if (transfer.payoutMethod === PayoutMethod.CASH) {
      // Retiro en Efectivo de Ventanilla: descuenta saldo de la caja física
      let cashAccountId = dto.cashAccountId;
      if (!cashAccountId) {
        const defaultAcc = await this.prisma.cashAccount.findFirst({
          where: { currency },
        });
        cashAccountId = defaultAcc?.id;
      }

      if (!cashAccountId) {
        throw new BadRequestException('Debe seleccionar la caja de donde se entregará el efectivo');
      }

      const cashAccount = await this.prisma.cashAccount.findUnique({
        where: { id: cashAccountId },
        include: { office: { include: { country: true } } },
      });
      if (!cashAccount) throw new NotFoundException('Cuenta de caja no encontrada');

      const session = await this.cash.requireOpenSession(cashAccountId);

      if (Number(cashAccount.balance) < amount) {
        throw new BadRequestException(`Saldo de caja insuficiente (${cashAccount.balance} ${currency} disponible para entregar ${amount} ${currency})`);
      }

      const movement = await this.cash.applyCashMovement({
        cashAccountId,
        sessionId: session.id,
        type: CashMovementType.CASH_OUT,
        amount,
        currency,
        description: `CASH-OUT retiro ${transfer.reference}`,
        actorId: actor.userId,
        transferId: transfer.id,
      });
      cashMovementId = movement.id;

      await this.prisma.payout.create({
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

      // Contabilidad Efectivo: DEBIT Pasivo Remesas (disminuye pasivo), CREDIT Caja Efectivo (disminuye saldo caja)
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
            description: `Entrega de efectivo en ventanilla ${transfer.reference}`,
          },
        ],
      });
    } else if (transfer.payoutMethod === PayoutMethod.MOBILE_WALLET) {
      // Abono por Yape (Billetera Móvil)
      const payout = await this.prisma.payout.create({
        data: {
          transferId: transfer.id,
          method: PayoutMethod.MOBILE_WALLET,
          status: PayoutStatus.PAID,
          amount,
          currency,
          bankRef: `YAPE-${transfer.beneficiary.phone || transfer.reference}`,
          processedById: actor.userId,
          processedAt: new Date(),
        },
      });

      // Contabilidad Yape: DEBIT Pasivo Remesas, CREDIT Banco BCP / Yape (1010-PE)
      await this.ledger.postDoubleEntry({
        entryGroup: `${transfer.reference}-YAPEPAYOUT`,
        transferId: transfer.id,
        actor,
        entries: [
          {
            accountId: (await this.ledger.mustGetAccountByCode(`2030-${countryCode}`)).id,
            side: LedgerEntrySide.DEBIT,
            amount,
            currency,
            description: `Cierre pasivo abono Yape ${transfer.reference}`,
          },
          {
            accountId: (await this.ledger.mustGetAccountByCode(`1010-${countryCode}`)).id,
            side: LedgerEntrySide.CREDIT,
            amount,
            currency,
            description: `Abono Yape ${transfer.beneficiary.fullName} ${transfer.reference}`,
          },
        ],
      });
    } else {
      // Abono por Cuenta Bancaria
      const payout = await this.prisma.payout.create({
        data: {
          transferId: transfer.id,
          method: PayoutMethod.BANK,
          status: PayoutStatus.PAID,
          amount,
          currency,
          bankName: transfer.payoutAccount?.bankName ?? 'Banco Destino',
          accountNumber: transfer.payoutAccount?.accountNumber ?? null,
          bankRef: `BANK-${transfer.reference}`,
          processedById: actor.userId,
          processedAt: new Date(),
        },
      });

      // Contabilidad Banco: DEBIT Pasivo Remesas, CREDIT Banco Destino (1010-PE / 1010-EC)
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
            description: `Cierre pasivo transferencia bancaria ${transfer.reference}`,
          },
          {
            accountId: (await this.ledger.mustGetAccountByCode(`1010-${countryCode}`)).id,
            side: LedgerEntrySide.CREDIT,
            amount,
            currency,
            description: `Transferencia bancaria ${transfer.beneficiary.fullName} ${transfer.reference}`,
          },
        ],
      });
    }

    // 3. Invalidar código de retiro para que NO se pueda volver a pagar
    await this.prisma.transfer.update({
      where: { id: transfer.id },
      data: { withdrawalUsed: true },
    });

    await this.transfers.transition(transfer.id, TransferStatus.PAID, actor, 'Fondos entregados al beneficiario');
    await this.transfers.transition(transfer.id, TransferStatus.COMPLETED, actor, 'Operación CANCELADA / PAGADA con éxito');

    await this.audit.record({
      actor,
      action: AuditAction.PAYOUT,
      entity: 'Payout',
      entityId: transfer.id,
      after: { transferId: transfer.id, amount, currency, payoutMethod: transfer.payoutMethod },
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

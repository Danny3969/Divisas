import { TRANSFER_STATE_MACHINE, makeTransferReference, makeWithdrawalCode } from '../src/transfers/transfers.service';
import { TransferStatus } from '@prisma/client';

const ALL = Object.values(TransferStatus);

describe('Máquina de estados de transferencias', () => {
  it('cubre todas las transiciones del flujo CASH end-to-end', () => {
    const happyPath: TransferStatus[] = [
      TransferStatus.DRAFT,
      TransferStatus.QUOTED,
      TransferStatus.CONFIRMED,
      TransferStatus.AWAITING_PAYMENT,
      TransferStatus.PAYMENT_RECEIVED,
      TransferStatus.RECONCILIATION,
      TransferStatus.RISK_CHECK,
      TransferStatus.APPROVED,
      TransferStatus.SETTLEMENT_PENDING,
      TransferStatus.PAYOUT_PROCESSING,
      TransferStatus.PAID,
      TransferStatus.COMPLETED,
    ];
    for (let i = 0; i < happyPath.length - 1; i++) {
      const from = happyPath[i];
      const to = happyPath[i + 1];
      expect(TRANSFER_STATE_MACHINE[from]).toContain(to);
    }
  });

  it('cubre el flujo BANK hasta COMPLETED', () => {
    const bankPath: TransferStatus[] = [
      TransferStatus.CONFIRMED,
      TransferStatus.AWAITING_PAYMENT,
      TransferStatus.PAYMENT_RECEIVED,
      TransferStatus.RECONCILIATION,
      TransferStatus.RISK_CHECK,
      TransferStatus.APPROVED,
      TransferStatus.SETTLEMENT_PENDING,
      TransferStatus.PAYOUT_PROCESSING,
      TransferStatus.PAID,
      TransferStatus.COMPLETED,
    ];
    for (let i = 0; i < bankPath.length - 1; i++) {
      expect(TRANSFER_STATE_MACHINE[bankPath[i]]).toContain(bankPath[i + 1]);
    }
  });

  it('permite las rutas de riesgo y rechazo', () => {
    expect(TRANSFER_STATE_MACHINE[TransferStatus.RISK_CHECK]).toContain(TransferStatus.MANUAL_REVIEW);
    expect(TRANSFER_STATE_MACHINE[TransferStatus.RISK_CHECK]).toContain(TransferStatus.AML_REVIEW);
    expect(TRANSFER_STATE_MACHINE[TransferStatus.RISK_CHECK]).toContain(TransferStatus.RISK_BLOCKED);
    expect(TRANSFER_STATE_MACHINE[TransferStatus.AML_REVIEW]).toContain(TransferStatus.APPROVED);
    expect(TRANSFER_STATE_MACHINE[TransferStatus.AML_REVIEW]).toContain(TransferStatus.RISK_BLOCKED);
    expect(TRANSFER_STATE_MACHINE[TransferStatus.RISK_BLOCKED]).toContain(TransferStatus.REFUND_PENDING);
  });

  it('COMPLETED es terminal', () => {
    expect(TRANSFER_STATE_MACHINE[TransferStatus.COMPLETED]).toHaveLength(0);
  });

  it('no permite saltos inválidos', () => {
    expect(TRANSFER_STATE_MACHINE[TransferStatus.CONFIRMED]).not.toContain(TransferStatus.COMPLETED);
    expect(TRANSFER_STATE_MACHINE[TransferStatus.AWAITING_PAYMENT]).not.toContain(TransferStatus.APPROVED);
    expect(TRANSFER_STATE_MACHINE[TransferStatus.PAYMENT_RECEIVED]).not.toContain(TransferStatus.SETTLEMENT_PENDING);
  });

  it('todo estado tiene una entrada definida en la máquina', () => {
    for (const s of ALL) {
      expect(Array.isArray(TRANSFER_STATE_MACHINE[s])).toBe(true);
    }
  });
});

describe('Generadores de referencia y código', () => {
  it('genera referencias con formato TRX-XXXXXXXX', () => {
    for (let i = 0; i < 50; i++) {
      const ref = makeTransferReference();
      expect(ref).toMatch(/^TRX-[A-Z2-9]{8}$/);
    }
  });

  it('genera códigos de retiro con formato XXXX-XXXX-XXXX', () => {
    for (let i = 0; i < 50; i++) {
      const code = makeWithdrawalCode();
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    }
  });

  it('no usa caracteres ambiguos (O, 0, I, 1)', () => {
    for (let i = 0; i < 200; i++) {
      expect(makeWithdrawalCode()).not.toMatch(/[OI01]/);
      expect(makeTransferReference()).not.toMatch(/[OI01]/);
    }
  });

  it('genera referencias únicas', () => {
    const refs = new Set(Array.from({ length: 500 }, () => makeTransferReference()));
    expect(refs.size).toBe(500);
  });
});

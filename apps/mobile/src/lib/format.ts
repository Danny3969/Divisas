import type { TransferStatus } from "./types";

const nf = (n: number, currency: string) =>
  new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency,
  }).format(n);

export function fmtMoney(amount: number, currency: string): string {
  try {
    return nf(amount, currency);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "Cliente",
  CASHIER: "Cajero",
  SUPERVISOR: "Supervisor",
  COMPLIANCE: "Compliance",
  TREASURY: "Tesorería",
  ADMIN: "Administrador",
  AUDITOR: "Auditor",
};

export const STATUS_LABELS: Record<TransferStatus, string> = {
  DRAFT: "Borrador",
  QUOTED: "Cotizada",
  CONFIRMED: "Creada",
  AWAITING_PAYMENT: "Esperando pago",
  PAYMENT_RECEIVED: "Pago recibido",
  RECONCILIATION: "Verificando pago",
  RISK_CHECK: "Evaluando riesgo",
  APPROVED: "Aprobada",
  SETTLEMENT_PENDING: "Lista para envío",
  PAYOUT_PROCESSING: "Enviando dinero",
  PAID: "Pagada",
  COMPLETED: "Completada",
  QUOTE_EXPIRED: "Cotización vencida",
  PAYMENT_MISMATCH: "Pago con diferencia",
  PAYMENT_EXPIRED: "Pago vencido",
  MANUAL_REVIEW: "En revisión",
  AML_REVIEW: "Revisión AML",
  RISK_BLOCKED: "Bloqueada por riesgo",
  PAYOUT_FAILED: "Envío falló",
  PAYOUT_REJECTED: "Envío rechazado",
};

export const STATUS_COLORS: Record<TransferStatus, string> = {
  DRAFT: "#64748b",
  QUOTED: "#64748b",
  CONFIRMED: "#2563eb",
  AWAITING_PAYMENT: "#d97706",
  PAYMENT_RECEIVED: "#2563eb",
  RECONCILIATION: "#2563eb",
  RISK_CHECK: "#2563eb",
  APPROVED: "#059669",
  SETTLEMENT_PENDING: "#059669",
  PAYOUT_PROCESSING: "#7c3aed",
  PAID: "#059669",
  COMPLETED: "#059669",
  QUOTE_EXPIRED: "#94a3b8",
  PAYMENT_MISMATCH: "#dc2626",
  PAYMENT_EXPIRED: "#dc2626",
  MANUAL_REVIEW: "#d97706",
  AML_REVIEW: "#d97706",
  RISK_BLOCKED: "#dc2626",
  PAYOUT_FAILED: "#dc2626",
  PAYOUT_REJECTED: "#dc2626",
};

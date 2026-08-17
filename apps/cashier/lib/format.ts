export const fmtMoney = (n: number | string, currency: string) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(n));

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const fmtDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  QUOTED: "Cotizada",
  CONFIRMED: "Confirmada",
  AWAITING_PAYMENT: "Esperando pago",
  PAYMENT_RECEIVED: "Pago recibido",
  RECONCILIATION: "Conciliación",
  RISK_CHECK: "Control de riesgo",
  APPROVED: "Aprobada",
  SETTLEMENT_PENDING: "Liquidación pendiente",
  PAYOUT_PROCESSING: "Procesando pago",
  PAID: "Pagada",
  COMPLETED: "Completada",
  QUOTE_EXPIRED: "Cotización expirada",
  PAYMENT_MISMATCH: "Monto no coincide",
  PAYMENT_EXPIRED: "Pago expirado",
  MANUAL_REVIEW: "Revisión manual",
  AML_REVIEW: "Revisión AML",
  RISK_BLOCKED: "Bloqueada por riesgo",
  PAYOUT_FAILED: "Pago fallido",
  PAYOUT_REJECTED: "Pago rechazado",
};

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  QUOTED: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  AWAITING_PAYMENT: "bg-amber-100 text-amber-800",
  PAYMENT_RECEIVED: "bg-cyan-100 text-cyan-800",
  RECONCILIATION: "bg-cyan-100 text-cyan-800",
  RISK_CHECK: "bg-violet-100 text-violet-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  SETTLEMENT_PENDING: "bg-teal-100 text-teal-800",
  PAYOUT_PROCESSING: "bg-teal-100 text-teal-800",
  PAID: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  QUOTE_EXPIRED: "bg-slate-200 text-slate-600",
  PAYMENT_MISMATCH: "bg-orange-100 text-orange-800",
  PAYMENT_EXPIRED: "bg-slate-200 text-slate-600",
  MANUAL_REVIEW: "bg-orange-100 text-orange-800",
  AML_REVIEW: "bg-red-100 text-red-800",
  RISK_BLOCKED: "bg-red-100 text-red-800",
  PAYOUT_FAILED: "bg-red-100 text-red-800",
  PAYOUT_REJECTED: "bg-red-100 text-red-800",
};

export const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "Cliente",
  CASHIER: "Cajero",
  SUPERVISOR: "Supervisor",
  COMPLIANCE: "Compliance",
  TREASURY: "Tesorería",
  ADMIN: "Administrador",
  AUDITOR: "Auditor",
};

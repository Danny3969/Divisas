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

export const fmtPhone = (phone?: string | null, countryCode?: string) => {
  if (!phone) return "Sin teléfono";
  const raw = phone.trim();
  if (!raw) return "Sin teléfono";

  if (raw.startsWith("+")) {
    if (raw.startsWith("+593")) return `+593 ${raw.slice(4).trim()}`;
    if (raw.startsWith("+51")) return `+51 ${raw.slice(3).trim()}`;
    return raw;
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "Sin teléfono";

  if (digits.startsWith("593")) return `+593 ${digits.slice(3)}`;
  if (digits.startsWith("51")) return `+51 ${digits.slice(2)}`;

  const prefix = countryCode === "EC" || countryCode === "ECUADOR" ? "+593" : "+51";
  return `${prefix} ${digits}`;
};

export const normalizePhone = (phone: string, countryCode?: string, selectedPrefix?: string) => {
  if (!phone) return "";
  const trimmed = phone.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("593")) return `+${digits}`;
  if (digits.startsWith("51")) return `+${digits}`;

  const prefix = selectedPrefix || (countryCode === "EC" || countryCode === "ECUADOR" ? "+593" : "+51");
  return `${prefix}${digits.replace(/^0+/, "")}`;
};

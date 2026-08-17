export type Role = "CUSTOMER" | "CASHIER" | "SUPERVISOR" | "COMPLIANCE" | "TREASURY" | "ADMIN" | "AUDITOR";

export type TransferStatus =
  | "DRAFT"
  | "QUOTED"
  | "CONFIRMED"
  | "AWAITING_PAYMENT"
  | "PAYMENT_RECEIVED"
  | "RECONCILIATION"
  | "RISK_CHECK"
  | "APPROVED"
  | "SETTLEMENT_PENDING"
  | "PAYOUT_PROCESSING"
  | "PAID"
  | "COMPLETED"
  | "QUOTE_EXPIRED"
  | "PAYMENT_MISMATCH"
  | "PAYMENT_EXPIRED"
  | "MANUAL_REVIEW"
  | "AML_REVIEW"
  | "RISK_BLOCKED"
  | "PAYOUT_FAILED"
  | "PAYOUT_REJECTED";

export type PaymentMethod = "CASH" | "BANK_TRANSFER";
export type PayoutMethod = "CASH" | "BANK" | "MOBILE_WALLET";

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  officeId?: string;
  officeName?: string;
  office?: { id: string; name: string; country?: { code: string; name: string } };
}

export interface Corridor {
  id: string;
  direction: "EC_TO_PE" | "PE_TO_EC";
  fromCurrency: string;
  toCurrency: string;
  fromCountry: { code: string; name: string };
  toCountry: { code: string; name: string };
  fxRates: { marketRate: string; sellRate: string }[];
  active: boolean;
}

export interface Customer {
  id: string;
  fullName: string;
  type: "PERSON" | "BUSINESS";
  documentType: "CEDULA" | "RUC" | "DNI" | "PASSPORT";
  documentNumber: string;
  email?: string;
  phone?: string;
  kycStatus: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  country?: { code: string; name: string };
}

export interface Country {
  id: string;
  code: string;
  name: string;
  currency: string;
}

export interface BeneficiaryAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  currency: string;
  accountType?: string;
}

export interface Beneficiary {
  id: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  relation?: string;
  accounts: BeneficiaryAccount[];
}

export interface Quote {
  id: string;
  corridorId: string;
  sendAmount: number;
  sendCurrency: string;
  receiveAmount: number;
  receiveCurrency: string;
  feeAmount: number;
  fxRate: string;
  expiresAt: string;
  status: string;
}

export interface TransferEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note?: string;
  createdAt: string;
  createdBy?: { fullName?: string; email?: string };
}

export interface Transfer {
  id: string;
  reference: string;
  status: TransferStatus;
  sendAmount: number;
  sendCurrency: string;
  receiveAmount: number;
  receiveCurrency: string;
  feeAmount: number;
  fxRate: string;
  withdrawalCode?: string;
  withdrawalUsed?: boolean;
  paymentMethod: PaymentMethod;
  payoutMethod: PayoutMethod;
  remittanceReason?: string;
  createdAt: string;
  corridor: {
    direction: string;
    fromCountry: { code: string; name: string };
    toCountry: { code: string; name: string };
  };
  sender: Customer;
  beneficiary: Beneficiary;
  quote?: Quote;
  events?: TransferEvent[];
  payments?: unknown[];
  payouts?: unknown[];
}

export interface CashAccount {
  id: string;
  code: string;
  currency: string;
  balance: string;
  country?: { code: string; name: string };
  office?: { id: string; name: string; country?: { code: string; name: string } };
}

export interface CashSession {
  id: string;
  cashAccountId: string;
  openingBalance: string;
  expectedBalance: string;
  actualBalance: string | null;
  discrepancy: string | null;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt?: string;
  cashAccount?: { code: string; currency: string };
  openedBy?: { fullName?: string; email?: string };
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

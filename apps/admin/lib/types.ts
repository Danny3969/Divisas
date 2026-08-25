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
  id?: string;
  email: string;
  fullName: string;
  role: Role;
  officeId?: string | null;
  officeName?: string | null;
  office?: { id: string; name: string; country?: { code: string; name: string } | null } | null;
}

export interface Corridor {
  id: string;
  direction: "EC_TO_PE" | "PE_TO_EC";
  fromCurrency: string;
  toCurrency: string;
  fromCountry: { code: string; name: string };
  toCountry: { code: string; name: string };
  fxRates: { marketRate: string; sellRate: string; spreadBps?: number; isManualOverride?: boolean; manualRate?: string; sourceApi?: string; active: boolean }[];
  active: boolean;
}

export interface FeeTier {
  id: string;
  minAmountPen: string | number;
  maxAmountPen: string | number;
  feeUsd: string | number;
  feePen?: string | number | null;
  corridorDirection?: "EC_TO_PE" | "PE_TO_EC" | null;
  description?: string | null;
  active: boolean;
  orderIndex: number;
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
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
  phone?: string;
  relation?: string;
  accounts: BeneficiaryAccount[];
  customer?: { id: string; fullName: string; documentType: string; documentNumber: string };
  createdAt?: string;
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
  openedBy?: { fullName: string; email: string };
  cashAccount?: { code: string; currency: string };
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  balance: string;
  country?: { code: string; name: string };
}

export interface LedgerEntry {
  id: string;
  accountId: string;
  side: "DEBIT" | "CREDIT";
  amount: string;
  currency?: string;
  entryGroup?: string;
  description?: string;
  transferId?: string;
  createdAt: string;
  account: LedgerAccount;
}

export interface Settlement {
  id: string;
  transferId: string;
  amount: string;
  currency: string;
  method?: string;
  status: string;
  createdAt: string;
  transfer: Transfer;
}

export interface Office {
  id: string;
  name: string;
  address?: string;
  country: { code: string; name: string };
  cashAccounts: CashAccount[];
}

export interface Expense {
  id: string;
  expenseNumber: string;
  category: string;
  supplierName: string;
  supplierTaxId?: string;
  invoiceNumber?: string;
  currency: string;
  subtotal: number | string;
  taxRate: number | string;
  taxAmount: number | string;
  total: number | string;
  paymentSourceType: "BANK" | "CASH";
  bankAccountId?: string;
  cashAccountId?: string;
  paidAt: string;
  receiptUrl?: string;
  notes?: string;
  entryGroupId?: string;
  bankAccount?: { bankName: string; currency: string; accountNumber: string };
  cashAccount?: { code: string; currency: string };
  createdBy?: { fullName: string; email: string };
  createdAt: string;
}

export interface AccountTransferRecord {
  id: string;
  transferNumber: string;
  fromType: "BANK" | "CASH";
  fromBankAccountId?: string;
  fromCashAccountId?: string;
  toType: "BANK" | "CASH";
  toBankAccountId?: string;
  toCashAccountId?: string;
  amount: number | string;
  currency: string;
  reference?: string;
  receiptUrl?: string;
  description?: string;
  transferredAt: string;
  fromBankAccount?: { bankName: string; currency: string; accountNumber: string };
  fromCashAccount?: { code: string; currency: string };
  toBankAccount?: { bankName: string; currency: string; accountNumber: string };
  toCashAccount?: { code: string; currency: string };
  createdBy?: { fullName: string; email: string };
}

export interface CapitalMovementRecord {
  id: string;
  movementNumber: string;
  type: "INJECTION" | "WITHDRAWAL";
  destinationType: "BANK" | "CASH";
  bankAccountId?: string;
  cashAccountId?: string;
  amount: number | string;
  currency: string;
  partnerName?: string;
  concept?: string;
  receiptUrl?: string;
  bankAccount?: { bankName: string; currency: string; accountNumber: string };
  cashAccount?: { code: string; currency: string };
  createdBy?: { fullName: string; email: string };
  createdAt: string;
}

export interface FinancialSummary {
  liquidity: {
    totalUsd: number;
    totalPen: number;
    banks: {
      totalUsd: number;
      totalPen: number;
      accounts: {
        id: string;
        name: string;
        accountNumber: string;
        currency: string;
        country: string;
        balance: number;
      }[];
    };
    cash: {
      totalUsd: number;
      totalPen: number;
      accounts: {
        id: string;
        code: string;
        currency: string;
        country: string;
        balance: number;
      }[];
    };
  };
  pnl: {
    revenue: {
      feesUsd: number;
      feesPen: number;
      fxProfitUsd: number;
      totalRevenueUsd: number;
      totalRevenuePen: number;
    };
    expenses: {
      totalUsd: number;
      totalPen: number;
      byCategory: Record<string, { count: number; totalUsd: number; totalPen: number }>;
      count: number;
    };
    netProfit: {
      usd: number;
      pen: number;
    };
    totalTransfersCompleted: number;
    transferredVolumeUsd: number;
  };
  ledgerAccounts: {
    id: string;
    code: string;
    name: string;
    type: string;
    currency: string;
    balance: number;
  }[];
}

export interface Supplier {
  id: string;
  name: string;
  taxId?: string;
  countryId: string;
  category: string;
  phone?: string;
  email?: string;
  address?: string;
  bankName?: string;
  bankAccountNumber?: string;
  notes?: string;
  active: boolean;
  country?: { code: string; name: string };
  createdAt: string;
}

export interface Employee {
  id: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  countryId: string;
  position: string;
  baseSalary: number | string;
  salaryCurrency: string;
  paymentFrequency: string;
  bankName?: string;
  bankAccountNumber?: string;
  phone?: string;
  email?: string;
  hiredAt: string;
  active: boolean;
  country?: { code: string; name: string };
  createdAt: string;
}

export interface PayrollPayment {
  id: string;
  payrollNumber: string;
  employeeId: string;
  amount: number | string;
  currency: string;
  period: string;
  paymentSourceType: "BANK" | "CASH";
  bankAccountId?: string;
  cashAccountId?: string;
  paidAt: string;
  receiptUrl?: string;
  notes?: string;
  employee?: Employee;
  bankAccount?: { bankName: string; currency: string; accountNumber: string };
  cashAccount?: { code: string; currency: string };
  createdBy?: { fullName: string; email: string };
  createdAt: string;
}

export interface BankStatementLine {
  id: string;
  bankStatementId: string;
  date: string;
  description: string;
  reference?: string;
  amount: number | string;
  type: "DEPOSIT" | "WITHDRAWAL";
  matched: boolean;
  matchedType?: string;
  matchedRef?: string;
  createdAt: string;
}

export interface BankStatement {
  id: string;
  bankAccountId: string;
  fileName: string;
  totalDeposits: number | string;
  totalWithdrawals: number | string;
  linesCount: number;
  matchedCount: number;
  status: "PENDING" | "PARTIALLY_MATCHED" | "RECONCILED";
  uploadedAt: string;
  bankAccount?: { bankName: string; accountNumber: string; currency: string };
  lines?: BankStatementLine[];
}


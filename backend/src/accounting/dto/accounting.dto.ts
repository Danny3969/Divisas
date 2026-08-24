import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseDto {
  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsString()
  supplierName: string;

  @IsOptional()
  @IsString()
  supplierTaxId?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsString()
  currency: string; // USD | PEN

  @IsNumber()
  @Min(0.01)
  subtotal: number;

  @IsNumber()
  @Min(0)
  taxRate: number;

  @IsNumber()
  @Min(0)
  taxAmount: number;

  @IsNumber()
  @Min(0.01)
  total: number;

  @IsString()
  paymentSourceType: 'BANK' | 'CASH';

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  cashAccountId?: string;

  @IsOptional()
  @IsString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateAccountTransferDto {
  @IsString()
  fromType: 'BANK' | 'CASH';

  @IsOptional()
  @IsString()
  fromBankAccountId?: string;

  @IsOptional()
  @IsString()
  fromCashAccountId?: string;

  @IsString()
  toType: 'BANK' | 'CASH';

  @IsOptional()
  @IsString()
  toBankAccountId?: string;

  @IsOptional()
  @IsString()
  toCashAccountId?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  currency: string; // USD | PEN

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateCapitalMovementDto {
  @IsString()
  type: 'INJECTION' | 'WITHDRAWAL';

  @IsString()
  destinationType: 'BANK' | 'CASH';

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  cashAccountId?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  currency: string; // USD | PEN

  @IsOptional()
  @IsString()
  partnerName?: string;

  @IsOptional()
  @IsString()
  concept?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

// ============ PROVEEDORES ============

export class CreateSupplierDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsString()
  countryCode: string; // EC | PE

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ EMPLEADOS / NÓMINA ============

export class CreateEmployeeDto {
  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  documentType?: 'CEDULA' | 'DNI' | 'PASSPORT' | 'RUC';

  @IsString()
  documentNumber: string;

  @IsString()
  countryCode: string; // EC | PE

  @IsString()
  position: string; // Cajero, Administrador, etc.

  @IsNumber()
  @Min(0)
  baseSalary: number;

  @IsString()
  salaryCurrency: string; // USD | PEN

  @IsOptional()
  @IsString()
  paymentFrequency?: string; // MONTHLY | BIWEEKLY

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  hiredAt?: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseSalary?: number;

  @IsOptional()
  @IsString()
  salaryCurrency?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;
}

export class CreatePayrollPaymentDto {
  @IsString()
  employeeId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  currency: string; // USD | PEN

  @IsString()
  period: string; // p. ej. "Agosto 2026"

  @IsString()
  paymentSourceType: 'BANK' | 'CASH';

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  cashAccountId?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ MOVIMIENTOS Y CONCILIACIÓN BANCARIA ============

export class CreateBankMovementDto {
  @IsString()
  bankAccountId: string;

  @IsString()
  type: 'DEPOSIT' | 'WITHDRAWAL';

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  currency: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

export class BankStatementRawLineDto {
  @IsString()
  date: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsNumber()
  amount: number; // positive for deposit, negative or positive for withdrawal

  @IsString()
  type: 'DEPOSIT' | 'WITHDRAWAL';
}

export class UploadBankStatementDto {
  @IsString()
  bankAccountId: string;

  @IsString()
  fileName: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankStatementRawLineDto)
  lines: BankStatementRawLineDto[];
}

export class MatchBankStatementLineDto {
  @IsString()
  lineId: string;

  @IsString()
  action: 'MATCH' | 'CREATE_EXPENSE' | 'CREATE_TRANSFER' | 'CREATE_CAPITAL' | 'IGNORE';

  @IsOptional()
  @IsString()
  matchedRef?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  supplierName?: string;
}

// ============ RESET Y SALDOS INICIALES ============

export class ResetInitialDataDto {
  @IsNumber()
  @Min(0)
  pichinchaBalanceUsd: number;

  @IsNumber()
  @Min(0)
  cashEcBalanceUsd: number;

  @IsNumber()
  @Min(0)
  bcpBalancePen: number;

  @IsNumber()
  @Min(0)
  cashPeBalancePen: number;

  @IsOptional()
  @IsString()
  partnerName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

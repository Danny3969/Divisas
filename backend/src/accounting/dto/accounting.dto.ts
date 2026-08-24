import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';

export enum ExpenseCategory {
  RENT = 'RENT',
  UTILITIES = 'UTILITIES',
  PAYROLL = 'PAYROLL',
  BANK_FEES = 'BANK_FEES',
  SOFTWARE_HOSTING = 'SOFTWARE_HOSTING',
  OFFICE_SUPPLIES = 'OFFICE_SUPPLIES',
  MARKETING = 'MARKETING',
  TAXES = 'TAXES',
  OTHER = 'OTHER',
}

export class CreateExpenseDto {
  @IsEnum(ExpenseCategory)
  @IsNotEmpty()
  category: ExpenseCategory;

  @IsString()
  @IsNotEmpty()
  supplierName: string;

  @IsString()
  @IsOptional()
  supplierTaxId?: string;

  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @IsString()
  @IsNotEmpty()
  currency: string; // USD | PEN

  @IsNumber()
  @Min(0.01)
  subtotal: number;

  @IsNumber()
  @IsOptional()
  taxRate?: number; // 15.00 o 18.00 o 0.00

  @IsNumber()
  @IsOptional()
  taxAmount?: number;

  @IsNumber()
  @Min(0.01)
  total: number;

  @IsString()
  @IsNotEmpty()
  paymentSourceType: 'BANK' | 'CASH';

  @IsString()
  @IsOptional()
  bankAccountId?: string;

  @IsString()
  @IsOptional()
  cashAccountId?: string;

  @IsString()
  @IsOptional()
  paidAt?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string; // Data URL / Base64 o URL comprobante

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateAccountTransferDto {
  @IsString()
  @IsNotEmpty()
  fromType: 'BANK' | 'CASH';

  @IsString()
  @IsOptional()
  fromBankAccountId?: string;

  @IsString()
  @IsOptional()
  fromCashAccountId?: string;

  @IsString()
  @IsNotEmpty()
  toType: 'BANK' | 'CASH';

  @IsString()
  @IsOptional()
  toBankAccountId?: string;

  @IsString()
  @IsOptional()
  toCashAccountId?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateCapitalMovementDto {
  @IsString()
  @IsNotEmpty()
  type: 'INJECTION' | 'WITHDRAWAL';

  @IsString()
  @IsNotEmpty()
  destinationType: 'BANK' | 'CASH';

  @IsString()
  @IsOptional()
  bankAccountId?: string;

  @IsString()
  @IsOptional()
  cashAccountId?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsOptional()
  partnerName?: string;

  @IsString()
  @IsOptional()
  concept?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;
}

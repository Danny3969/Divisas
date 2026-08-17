import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RegisterCashPaymentDto {
  @IsString()
  transferId: string;

  @IsString()
  cashAccountId: string;

  @IsOptional()
  @IsString()
  referenceCode?: string;

  @IsOptional()
  @IsString()
  sourceOfFunds?: string; // Sueldo/Honorarios, Ahorros, Venta de Inmueble, Préstamo, etc.

  @IsOptional()
  @IsString()
  highBillSerials?: string; // Billetes de alta denominación recibidos
}

export class RegisterBankPaymentDto {
  @IsString()
  transferId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  bankName: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  transactionRef?: string;

  @IsOptional()
  @IsString()
  sourceOfFunds?: string;
}

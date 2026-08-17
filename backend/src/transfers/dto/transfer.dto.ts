import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentMethod, PayoutMethod, TransferStatus } from '@prisma/client';

export class CreateTransferDto {
  @IsString()
  quoteId: string;

  @IsString()
  senderCustomerId: string;

  @IsString()
  beneficiaryId: string;

  @IsEnum(PayoutMethod)
  payoutMethod: PayoutMethod;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  payoutAccountId?: string; // requerido si payoutMethod = BANK

  @IsOptional()
  @IsString()
  remittanceReason?: string; // Ayuda Familiar, Gastos Médicos, Pago Proveedor Comercial, Educación, etc.
}

export class ChangeTransferStatusDto {
  @IsEnum(TransferStatus)
  toStatus: TransferStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

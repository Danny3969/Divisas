import { IsOptional, IsString } from 'class-validator';

export class ProcessCashOutDto {
  @IsString()
  transferId: string;

  @IsString()
  withdrawalCode: string;

  @IsOptional()
  @IsString()
  cashAccountId?: string;

  @IsOptional()
  @IsString()
  beneficiaryDocument?: string; // documento del beneficiario presentado en ventanilla
}

export class ProcessBankPayoutDto {
  @IsString()
  transferId: string;
}

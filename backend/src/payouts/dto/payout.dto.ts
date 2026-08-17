import { IsString } from 'class-validator';

export class ProcessCashOutDto {
  @IsString()
  transferId: string;

  @IsString()
  withdrawalCode: string;

  @IsString()
  cashAccountId: string;

  @IsString()
  beneficiaryDocument: string; // documento del beneficiario presentado en ventanilla
}

export class ProcessBankPayoutDto {
  @IsString()
  transferId: string;
}

import { IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { LedgerAccountType, LedgerEntrySide } from '@prisma/client';

export class CreateLedgerAccountDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsEnum(LedgerAccountType)
  type: LedgerAccountType;

  @IsString()
  currency: string;
}

export class LedgerEntryInput {
  @IsString()
  accountId: string;

  @IsEnum(LedgerEntrySide)
  side: LedgerEntrySide;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  description: string;
}

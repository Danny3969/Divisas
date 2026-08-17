import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OpenCashSessionDto {
  @IsString()
  cashAccountId: string;

  @IsNumber()
  @Min(0)
  openingBalance: number;
}

export class CloseCashSessionDto {
  @IsNumber()
  @Min(0)
  actualBalance: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateCashAccountDto {
  @IsString()
  code: string;

  @IsString()
  officeId: string;

  @IsString()
  currency: string;
}

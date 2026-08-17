import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SetFxRateDto {
  @IsString()
  corridorId: string;

  @IsNumber()
  marketRate: number;

  @IsNumber()
  sellRate: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  spreadBps?: number;

  @IsOptional()
  isManualOverride?: boolean;

  @IsOptional()
  @IsNumber()
  manualRate?: number;
}

export class CreateCorridorDto {
  @IsString()
  fromCountryId: string;

  @IsString()
  toCountryId: string;

  @IsString()
  fromCurrency: string;

  @IsString()
  toCurrency: string;
}

export class CreateCountryDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  currency: string;
}

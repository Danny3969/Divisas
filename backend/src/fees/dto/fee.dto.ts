import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CorridorDirection } from '@prisma/client';

export class CreateFeeTierDto {
  @IsNumber()
  @Min(0)
  minAmountPen: number;

  @IsNumber()
  @Min(0)
  maxAmountPen: number;

  @IsNumber()
  @Min(0)
  feeUsd: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feePen?: number;

  @IsOptional()
  @IsEnum(CorridorDirection)
  corridorDirection?: CorridorDirection;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  orderIndex?: number;
}

export class UpdateFeeTierDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmountPen?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmountPen?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feeUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feePen?: number;

  @IsOptional()
  @IsEnum(CorridorDirection)
  corridorDirection?: CorridorDirection;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  orderIndex?: number;
}

export class CalculateFeeDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  currency: string; // 'USD' or 'PEN'

  @IsString()
  corridorDirection: CorridorDirection; // 'EC_TO_PE' or 'PE_TO_EC'
}

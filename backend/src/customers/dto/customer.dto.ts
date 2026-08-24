import { IsEnum, IsNotEmpty, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { CustomerType, DocumentType } from '@prisma/client';

export class CreateCustomerDto {
  @IsEnum(CustomerType)
  type: CustomerType;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsString()
  @IsNotEmpty()
  documentNumber: string;

  @IsString()
  @IsNotEmpty()
  countryId: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class ApproveKycDto {
  @IsOptional()
  @IsString()
  decision: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  riskScore?: number;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  countryId?: string;
}

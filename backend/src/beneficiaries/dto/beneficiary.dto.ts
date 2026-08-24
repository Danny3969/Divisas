import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class CreateBeneficiaryDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

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
  phone?: string;
}

export class CreateBeneficiaryAccountDto {
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @IsOptional()
  @IsString()
  accountType?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdateBeneficiaryDto {
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
  phone?: string;

  @IsOptional()
  @IsString()
  countryId?: string;
}

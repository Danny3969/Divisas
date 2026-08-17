import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerType, DocumentType, Role } from '@prisma/client';

export class RegisterCustomerDto {
  @IsEnum(CustomerType)
  type: CustomerType;

  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsString()
  @IsNotEmpty()
  documentNumber: string;

  @IsString()
  @IsNotEmpty()
  countryId: string;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(Role)
  role: Role = Role.CUSTOMER;

  @IsOptional()
  @IsString()
  officeId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterCustomerDto)
  customer?: RegisterCustomerDto;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

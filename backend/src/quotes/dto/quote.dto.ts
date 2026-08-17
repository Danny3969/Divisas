import { IsNumber, IsString, Min } from 'class-validator';

export class CreateQuoteDto {
  @IsString()
  corridorId: string;

  @IsNumber()
  @Min(1)
  sendAmount: number;

  @IsString()
  sendCurrency: string;

  @IsString()
  senderCustomerId: string;
}

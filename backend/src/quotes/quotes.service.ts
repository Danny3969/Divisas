import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FxService } from '../fx/fx.service';
import { CreateQuoteDto } from './dto/quote.dto';
import { AuthUser } from '../common/current-user.decorator';
import { CorridorDirection, Role } from '@prisma/client';

export const QUOTE_TTL_MINUTES = 5;

// Regla de comisión plana por corredor (configurable en fases posteriores)
export function feeForCorridor(direction: CorridorDirection): { fee: number; currency: string } {
  if (direction === CorridorDirection.EC_TO_PE) {
    return { fee: 4, currency: 'USD' };
  }
  return { fee: 14, currency: 'PEN' };
}

@Injectable()
export class QuotesService {
  constructor(private prisma: PrismaService, private fx: FxService) {}

  async create(dto: CreateQuoteDto, actor?: AuthUser) {
    const corridor = await this.prisma.corridor.findUnique({
      where: { id: dto.corridorId },
      include: { fxRates: { where: { active: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!corridor || !corridor.active) throw new BadRequestException('Corredor no disponible');
    if (corridor.fxRates.length === 0) throw new BadRequestException('No hay tasa de cambio activa para este corredor');

    const customer = await this.prisma.customer.findUnique({ where: { id: dto.senderCustomerId } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    if (actor?.role === Role.CUSTOMER && customer.userId !== actor.userId) {
      throw new ForbiddenException('Solo puede cotizar con su propio perfil');
    }
    if (customer.kycStatus !== 'APPROVED') {
      throw new BadRequestException('El cliente debe tener KYC aprobado para cotizar');
    }

    const rate = corridor.fxRates[0];
    const fee = feeForCorridor(corridor.direction);
    const netSend = dto.sendAmount - fee.fee;
    if (netSend <= 0) throw new BadRequestException('El monto enviado debe superar la comisión');

    const sellRate = Number(rate.sellRate);
    const receiveAmount = Math.round(netSend * sellRate * 100) / 100;
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MINUTES * 60 * 1000);

    const quote = await this.prisma.quote.create({
      data: {
        corridorId: corridor.id,
        fxRateId: rate.id,
        sendAmount: dto.sendAmount,
        sendCurrency: dto.sendCurrency,
        feeAmount: fee.fee,
        feeCurrency: fee.currency,
        fxRate: sellRate,
        receiveAmount,
        receiveCurrency: corridor.toCurrency,
        expiresAt,
      },
    });
    return this.prisma.quote.findUnique({ where: { id: quote.id }, include: { corridor: true } });
  }

  async findActive(id: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id }, include: { corridor: true } });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    if (quote.status !== 'ACTIVE') throw new BadRequestException(`Cotización ${quote.status}`);
    if (new Date(quote.expiresAt) < new Date()) {
      await this.prisma.quote.update({ where: { id }, data: { status: 'EXPIRED' } });
      throw new BadRequestException('Cotización expirada');
    }
    return quote;
  }
}

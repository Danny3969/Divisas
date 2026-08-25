import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FxService } from '../fx/fx.service';
import { FeesService } from '../fees/fees.service';
import { CreateQuoteDto } from './dto/quote.dto';
import { AuthUser } from '../common/current-user.decorator';
import { Role } from '@prisma/client';

export const QUOTE_TTL_MINUTES = 5;

@Injectable()
export class QuotesService {
  constructor(
    private prisma: PrismaService,
    private fx: FxService,
    private fees: FeesService,
  ) {}

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
    const sellRate = Number(rate.sellRate);

    // Dynamic Fee Calculation based on PEN Soles Tier
    const feeResult = await this.fees.calculateFee(corridor.direction, dto.sendAmount, sellRate);
    
    let totalSendAmount = dto.sendAmount;
    let receiveAmount = 0;
    let feeAmount = feeResult.feeAmount;
    let feeCurrency = feeResult.feeCurrency;

    if (corridor.direction === 'EC_TO_PE') {
      // Ecuador (USD) -> Peru (PEN)
      // Origen cobra: Monto deseado + comisión origen ($1 USD según tramo)
      // Destino entrega: (Monto deseado * TC) - comisión destino (S/. 3.75 según tramo)
      totalSendAmount = Math.round((dto.sendAmount + feeResult.feeUsd) * 100) / 100;
      const grossPen = dto.sendAmount * sellRate;
      receiveAmount = Math.round((grossPen - feeResult.feePen) * 100) / 100;
      feeAmount = feeResult.feeUsd;
      feeCurrency = 'USD';
    } else {
      // Peru (PEN) -> Ecuador (USD)
      // Origen cobra: Monto deseado + comisión origen (S/. 3.75 según tramo)
      // Destino entrega: (Monto deseado / TC) - comisión destino ($1 USD según tramo)
      totalSendAmount = Math.round((dto.sendAmount + feeResult.feePen) * 100) / 100;
      const grossUsd = dto.sendAmount / sellRate;
      receiveAmount = Math.round((grossUsd - feeResult.feeUsd) * 100) / 100;
      feeAmount = feeResult.feePen;
      feeCurrency = 'PEN';
    }

    if (receiveAmount <= 0) {
      throw new BadRequestException('El monto a entregar debe ser mayor a 0 tras descontar la comisión');
    }

    const expiresAt = new Date(Date.now() + QUOTE_TTL_MINUTES * 60 * 1000);

    const quote = await this.prisma.quote.create({
      data: {
        corridorId: corridor.id,
        fxRateId: rate.id,
        sendAmount: totalSendAmount,
        sendCurrency: dto.sendCurrency,
        feeAmount,
        feeCurrency,
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

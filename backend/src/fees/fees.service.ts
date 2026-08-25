import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CorridorDirection } from '@prisma/client';
import { CreateFeeTierDto, UpdateFeeTierDto } from './dto/fee.dto';
import { AuthUser } from '../common/current-user.decorator';

export interface FeeCalculationResult {
  feeAmount: number;
  feeCurrency: string;
  feeUsd: number;
  feePen: number;
  tierId?: string | null;
  tierDescription?: string | null;
  penReferenceAmount: number;
}

@Injectable()
export class FeesService {
  constructor(private prisma: PrismaService) {}

  async listActive(direction?: CorridorDirection) {
    return this.prisma.feeTier.findMany({
      where: {
        active: true,
        OR: [
          { corridorDirection: null },
          ...(direction ? [{ corridorDirection: direction }] : []),
        ],
      },
      orderBy: [{ orderIndex: 'asc' }, { minAmountPen: 'asc' }],
    });
  }

  async listAll() {
    return this.prisma.feeTier.findMany({
      orderBy: [{ orderIndex: 'asc' }, { minAmountPen: 'asc' }],
    });
  }

  async create(dto: CreateFeeTierDto, actor?: AuthUser) {
    if (dto.minAmountPen > dto.maxAmountPen) {
      throw new BadRequestException('El monto mínimo no puede ser mayor que el monto máximo');
    }

    const calculatedFeePen = dto.feePen ?? Number((dto.feeUsd * 3.75).toFixed(2));
    const description =
      dto.description ||
      `De S/. ${dto.minAmountPen} a S/. ${dto.maxAmountPen} ($${dto.feeUsd} USD)`;

    return this.prisma.feeTier.create({
      data: {
        minAmountPen: dto.minAmountPen,
        maxAmountPen: dto.maxAmountPen,
        feeUsd: dto.feeUsd,
        feePen: calculatedFeePen,
        corridorDirection: dto.corridorDirection,
        description,
        active: dto.active ?? true,
        orderIndex: dto.orderIndex ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateFeeTierDto, actor?: AuthUser) {
    const existing = await this.prisma.feeTier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tramo de comisión no encontrado');

    const minAmountPen = dto.minAmountPen ?? Number(existing.minAmountPen);
    const maxAmountPen = dto.maxAmountPen ?? Number(existing.maxAmountPen);
    if (minAmountPen > maxAmountPen) {
      throw new BadRequestException('El monto mínimo no puede ser mayor que el monto máximo');
    }

    const feeUsd = dto.feeUsd ?? Number(existing.feeUsd);
    const feePen = dto.feePen ?? (dto.feeUsd !== undefined ? Number((dto.feeUsd * 3.75).toFixed(2)) : existing.feePen);

    return this.prisma.feeTier.update({
      where: { id },
      data: {
        minAmountPen: dto.minAmountPen,
        maxAmountPen: dto.maxAmountPen,
        feeUsd: dto.feeUsd,
        feePen,
        corridorDirection: dto.corridorDirection,
        description: dto.description,
        active: dto.active,
        orderIndex: dto.orderIndex,
      },
    });
  }

  async delete(id: string, actor?: AuthUser) {
    const existing = await this.prisma.feeTier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tramo de comisión no encontrado');
    return this.prisma.feeTier.delete({ where: { id } });
  }

  async calculateFee(
    direction: CorridorDirection,
    sendAmount: number,
    sellRate: number,
  ): Promise<FeeCalculationResult> {
    const tiers = await this.listActive(direction);

    // Calcular el monto equivalente en Soles (PEN)
    let penReferenceAmount = sendAmount;
    if (direction === CorridorDirection.EC_TO_PE) {
      // De USD a PEN: se proyecta el monto bruto en Soles
      penReferenceAmount = sendAmount * sellRate;
    }

    // Buscar el tramo correspondiente
    let matchedTier = tiers.find(
      (t) =>
        penReferenceAmount >= Number(t.minAmountPen) &&
        penReferenceAmount <= Number(t.maxAmountPen),
    );

    // Fallback: si supera el máximo tramo, tomar el de mayor rango
    if (!matchedTier && tiers.length > 0) {
      if (penReferenceAmount > Number(tiers[tiers.length - 1].maxAmountPen)) {
        matchedTier = tiers[tiers.length - 1];
      } else {
        matchedTier = tiers[0];
      }
    }

    // Valores por defecto si la base de datos no tuviera tramos
    const feeUsd = matchedTier ? Number(matchedTier.feeUsd) : 2;
    const feePen = matchedTier && matchedTier.feePen ? Number(matchedTier.feePen) : Number((feeUsd * (sellRate || 3.75)).toFixed(2));

    if (direction === CorridorDirection.EC_TO_PE) {
      return {
        feeAmount: feeUsd,
        feeCurrency: 'USD',
        feeUsd,
        feePen,
        tierId: matchedTier?.id,
        tierDescription: matchedTier?.description,
        penReferenceAmount: Math.round(penReferenceAmount * 100) / 100,
      };
    } else {
      return {
        feeAmount: feePen,
        feeCurrency: 'PEN',
        feeUsd,
        feePen,
        tierId: matchedTier?.id,
        tierDescription: matchedTier?.description,
        penReferenceAmount: Math.round(penReferenceAmount * 100) / 100,
      };
    }
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SetFxRateDto, CreateCorridorDto, CreateCountryDto } from './dto/fx.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/current-user.decorator';
import { AuditAction, CorridorDirection } from '@prisma/client';

import { FxApiService } from './fx-api.service';

@Injectable()
export class FxService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private fxApi: FxApiService,
  ) {}

  async createCountry(dto: CreateCountryDto, actor: AuthUser) {
    const country = await this.prisma.country.create({
      data: dto,
    });
    await this.prisma.currency.upsert({
      where: { code: dto.currency },
      update: {},
      create: { code: dto.currency, name: dto.currency },
    });
    await this.audit.record({ actor, action: AuditAction.CREATE, entity: 'Country', entityId: country.id, after: dto });
    return country;
  }

  async createCorridor(dto: CreateCorridorDto, actor: AuthUser) {
    const direction: CorridorDirection = dto.fromCurrency === 'USD' ? CorridorDirection.EC_TO_PE : CorridorDirection.PE_TO_EC;
    const corridor = await this.prisma.corridor.create({ data: { ...dto, direction } });
    await this.audit.record({ actor, action: AuditAction.CREATE, entity: 'Corridor', entityId: corridor.id, after: dto });
    return corridor;
  }

  async setRate(dto: SetFxRateDto, actor: AuthUser) {
    const corridor = await this.prisma.corridor.findUnique({ where: { id: dto.corridorId } });
    if (!corridor) throw new NotFoundException('Corredor no encontrado');

    await this.prisma.fxRate.updateMany({
      where: { corridorId: dto.corridorId, active: true },
      data: { active: false },
    });

    const isManualOverride = dto.isManualOverride ?? false;
    const manualRate = dto.manualRate ?? (isManualOverride ? dto.sellRate : null);
    const sellRate = isManualOverride && manualRate ? manualRate : dto.sellRate;
    const spreadBps = dto.spreadBps ?? Math.round((dto.sellRate ? 1 - sellRate / dto.marketRate : 0) * 10000);

    const rate = await this.prisma.fxRate.create({
      data: {
        corridorId: dto.corridorId,
        marketRate: dto.marketRate,
        sellRate,
        spreadBps,
        isManualOverride,
        manualRate,
        sourceApi: isManualOverride ? 'MANUAL_TREASURY' : 'ADMIN_SET',
        lastFetchAt: new Date(),
      },
    });

    await this.audit.record({ actor, action: AuditAction.UPDATE, entity: 'FxRate', entityId: rate.id, after: dto });
    return rate;
  }

  async fetchAndRefreshRates(actor?: AuthUser) {
    const corridors = await this.prisma.corridor.findMany();
    const updatedRates: any[] = [];

    for (const corridor of corridors) {
      const activeRate = await this.getActiveRate(corridor.id);
      
      // Si Tesorería fijó una tasa manual, mantenemos la sobreescritura manual
      if (activeRate?.isManualOverride && activeRate.manualRate) {
        updatedRates.push(activeRate);
        continue;
      }

      const { rate: marketRate, source } = await this.fxApi.fetchMarketRate(corridor.fromCurrency, corridor.toCurrency);
      const spreadBps = activeRate?.spreadBps ?? 85;
      const sellRate = Number((marketRate * (1 - spreadBps / 10000)).toFixed(8));

      await this.prisma.fxRate.updateMany({
        where: { corridorId: corridor.id, active: true },
        data: { active: false },
      });

      const newRate = await this.prisma.fxRate.create({
        data: {
          corridorId: corridor.id,
          marketRate,
          sellRate,
          spreadBps,
          isManualOverride: false,
          sourceApi: source,
          lastFetchAt: new Date(),
        },
      });
      updatedRates.push(newRate);
    }

    if (actor) {
      await this.audit.record({ actor, action: AuditAction.UPDATE, entity: 'FxRate', entityId: 'bulk', after: { count: updatedRates.length } });
    }
    return updatedRates;
  }

  async getActiveRate(corridorId: string) {
    return this.prisma.fxRate.findFirst({
      where: { corridorId, active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listCorridors() {
    return this.prisma.corridor.findMany({
      include: {
        fromCountry: true,
        toCountry: true,
        fxRates: { where: { active: true }, take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async listCountries() {
    return this.prisma.country.findMany({ orderBy: { code: 'asc' } });
  }

  async listCurrencies() {
    return this.prisma.currency.findMany({ orderBy: { code: 'asc' } });
  }
}

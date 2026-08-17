import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { FxService } from './fx.service';
import { SetFxRateDto, CreateCorridorDto, CreateCountryDto } from './dto/fx.dto';
import { Role } from '@prisma/client';

@Controller('fx')
export class FxController {
  constructor(private service: FxService) {}

  @Get('countries')
  countries() {
    return this.service.listCountries();
  }

  @Get('currencies')
  currencies() {
    return this.service.listCurrencies();
  }

  @Get('corridors')
  corridors() {
    return this.service.listCorridors();
  }

  @Post('countries')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  createCountry(@Body() dto: CreateCountryDto, @CurrentUser() user: AuthUser) {
    return this.service.createCountry(dto, user);
  }

  @Post('corridors')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  createCorridor(@Body() dto: CreateCorridorDto, @CurrentUser() user: AuthUser) {
    return this.service.createCorridor(dto, user);
  }

  @Post('rates')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.TREASURY, Role.ADMIN)
  setRate(@Body() dto: SetFxRateDto, @CurrentUser() user: AuthUser) {
    return this.service.setRate(dto, user);
  }

  @Post('refresh')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.TREASURY, Role.ADMIN)
  refreshRates(@CurrentUser() user: AuthUser) {
    return this.service.fetchAndRefreshRates(user);
  }
}

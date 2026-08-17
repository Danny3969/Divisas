import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FxApiService {
  private readonly logger = new Logger(FxApiService.name);

  // Tasas de respaldo de mercado en caso de falla de la API externa
  private readonly FALLBACK_RATES: Record<string, number> = {
    'USD-PEN': 3.5200,
    'PEN-USD': 0.2841,
  };

  /**
   * Obtiene la tasa de mercado real entre dos monedas.
   * Soporta integración externa (ej: Frankfurter / ExchangeRate-API) con fallback automático.
   */
  async fetchMarketRate(fromCurrency: string, toCurrency: string): Promise<{ rate: number; source: string }> {
    const pair = `${fromCurrency}-${toCurrency}`;
    try {
      // Intento de consulta a API pública gratuita (ej: Frankfurter API)
      if (fromCurrency === 'USD' && toCurrency === 'PEN') {
        const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=PEN', {
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          const data: any = await response.json();
          if (data?.rates?.PEN) {
            this.logger.log(`Tasa obtenida de Frankfurter API: USD/PEN = ${data.rates.PEN}`);
            return { rate: Number(data.rates.PEN), source: 'Frankfurter API' };
          }
        }
      }
    } catch (err) {
      this.logger.warn(`No se pudo conectar a la API externa para ${pair}: ${err.message}. Usando tasa fallback.`);
    }

    const fallbackRate = this.FALLBACK_RATES[pair] ?? 1.0;
    return { rate: fallbackRate, source: 'SYSTEM_FALLBACK' };
  }
}

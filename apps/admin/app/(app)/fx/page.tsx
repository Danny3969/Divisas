"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Input, Select, Spinner } from "@/components/ui";
import { get, post } from "@/lib/api";
import type { Corridor } from "@/lib/types";

export default function FxPage() {
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [selected, setSelected] = useState("");
  const [marketRate, setMarketRate] = useState("");
  const [sellRate, setSellRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [isManualOverride, setIsManualOverride] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function run() {
      try {
        const data = await get<Corridor[]>("/fx/corridors");
        if (ignore) return;
        setCorridors(data.filter((c) => c.active));
        if (data.length > 0) {
          const c = data[0];
          setSelected(c.id);
          const rate = c.fxRates[0];
          if (rate) {
            setMarketRate(rate.marketRate);
            setSellRate(rate.sellRate);
            setIsManualOverride(rate.isManualOverride ?? false);
          }
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, []);

  const corridor = corridors.find((c) => c.id === selected);

  const selectCorridor = (id: string) => {
    setSelected(id);
    const rate = corridors.find((c) => c.id === id)?.fxRates[0];
    if (rate) {
      setMarketRate(rate.marketRate);
      setSellRate(rate.sellRate);
      setIsManualOverride(rate.isManualOverride ?? false);
    }
  };

  const save = async () => {
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      const res = (await post("/fx/rates", {
        corridorId: selected,
        marketRate: Number(marketRate),
        sellRate: Number(sellRate),
        isManualOverride,
        manualRate: isManualOverride ? Number(sellRate) : undefined,
      })) as { spreadBps?: number };
      setSuccess(
        `Tasa actualizada exitosamente (${isManualOverride ? "Sobreescritura Manual Tesorería" : "Tasa de Mercado"}, spread ${res.spreadBps ?? "—"} bps).`,
      );
      const data = await get<Corridor[]>("/fx/corridors");
      setCorridors(data.filter((c) => c.active));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar tasa");
    } finally {
      setWorking(false);
    }
  };

  const refreshFromApi = async () => {
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      await post("/fx/refresh", {});
      setSuccess("Tasas actualizadas desde la API externa de mercado.");
      const data = await get<Corridor[]>("/fx/corridors");
      setCorridors(data.filter((c) => c.active));
      if (selected) selectCorridor(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar desde API");
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Tasas de cambio</h1>
        <Button onClick={refreshFromApi} loading={working} variant="secondary">
          🔄 Actualizar desde API de Mercado
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      <div className="grid grid-cols-2 gap-4">
        {corridors.map((c) => {
          const rate = c.fxRates[0];
          return (
            <Card
              key={c.id}
              title={`${c.fromCountry.code} → ${c.toCountry.code}`}
              action={
                <Badge className={rate?.isManualOverride ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}>
                  {rate?.isManualOverride ? "Manual Tesorería" : rate?.sourceApi || "Automático API"}
                </Badge>
              }
            >
              <div className="space-y-1 text-sm">
                <div className="text-slate-600">
                  {c.fromCountry.name} ({c.fromCurrency}) →{" "}
                  {c.toCountry.name} ({c.toCurrency})
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mercado (API)</span>
                  <span className="font-semibold">{rate?.marketRate ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Venta (aplicada cliente)</span>
                  <span className="font-semibold text-emerald-700">{rate?.sellRate ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Spread</span>
                  <span>{rate?.spreadBps ?? "—"} bps</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="Ajuste y Control de Tasa (Tesorería)">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Corredor"
            value={selected}
            onChange={(e) => selectCorridor(e.target.value)}
          >
            {corridors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fromCountry.code} → {c.toCountry.code}
              </option>
            ))}
          </Select>
          <div className="text-sm text-slate-500 flex items-center">
            Tasa activa:{" "}
            <span className="font-bold ml-1">
              {corridor?.fxRates[0]
                ? `${corridor.fxRates[0].marketRate} / ${corridor.fxRates[0].sellRate}`
                : "—"}
            </span>
          </div>
          <Input
            label={`Tasa de mercado (por 1 ${corridor?.fromCurrency ?? ""})`}
            type="number"
            step="0.0001"
            value={marketRate}
            onChange={(e) => setMarketRate(e.target.value)}
          />
          <Input
            label={`Tasa de venta al cliente (por 1 ${corridor?.fromCurrency ?? ""})`}
            type="number"
            step="0.0001"
            value={sellRate}
            onChange={(e) => setSellRate(e.target.value)}
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="manualOverride"
            checked={isManualOverride}
            onChange={(e) => setIsManualOverride(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <label htmlFor="manualOverride" className="text-sm font-medium text-slate-700">
            Fijar como Sobreescritura Manual de Tesorería (Prevalece sobre la API de mercado)
          </label>
        </div>

        <Button onClick={save} loading={working} className="mt-4">
          Guardar tasa
        </Button>
      </Card>
    </div>
  );
}

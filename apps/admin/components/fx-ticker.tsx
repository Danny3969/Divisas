"use client";

import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import type { Corridor } from "@/lib/types";

export function FxTicker() {
  const [corridors, setCorridors] = useState<Corridor[]>([]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const data = await get<Corridor[]>("/fx/corridors");
        if (!ignore) setCorridors(data.filter((c) => c.active));
      } catch {
        /* fallback */
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  if (corridors.length === 0) return null;

  return (
    <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-xs font-mono shadow-md border-b-2 border-amber-500">
      <div className="flex items-center gap-6 overflow-x-auto">
        <span className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 text-xs">
          <span className="animate-pulse">🟢</span> TIPO DE CAMBIO OFICIAL DEL DÍA:
        </span>
        {corridors.map((c) => {
          const rate = c.fxRates[0];
          const isEcToPe = c.fromCountry.code === "EC";
          return (
            <div
              key={c.id}
              className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-md border border-slate-700 shadow-sm"
            >
              <span className="text-slate-200 font-bold">
                {isEcToPe ? "🇪🇨 USD → 🇵🇪 PEN" : "🇵🇪 PEN → 🇪🇨 USD"}:
              </span>
              <span className="font-extrabold text-emerald-400 text-base">
                {rate?.sellRate ?? "—"}
              </span>
              <span className="text-slate-400 text-[11px] ml-1">
                (1 {c.fromCurrency} = {rate?.sellRate} {c.toCurrency})
              </span>
            </div>
          );
        })}
      </div>
      <div className="text-slate-300 hidden lg:block text-xs font-semibold">
        🏦 Tasa oficial de Ventanilla en Tiempo Real
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Modal, Input, Select, Spinner } from "@/components/ui";
import { get, post, patch, del } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import type { FeeTier, Corridor } from "@/lib/types";

export default function FeesPage() {
  const [tiers, setTiers] = useState<FeeTier[]>([]);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<FeeTier | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [minAmountPen, setMinAmountPen] = useState("");
  const [maxAmountPen, setMaxAmountPen] = useState("");
  const [feeUsd, setFeeUsd] = useState("");
  const [feePen, setFeePen] = useState("");
  const [description, setDescription] = useState("");
  const [corridorDirection, setCorridorDirection] = useState<string>("ALL");
  const [active, setActive] = useState(true);
  const [orderIndex, setOrderIndex] = useState("0");

  // Live Calculator State
  const [calcAmount, setCalcAmount] = useState("100");
  const [calcDirection, setCalcDirection] = useState<"EC_TO_PE" | "PE_TO_EC">("EC_TO_PE");
  const [calcResult, setCalcResult] = useState<{
    feeAmount: number;
    feeCurrency: string;
    feeUsd: number;
    feePen: number;
    penReferenceAmount: number;
    tierDescription?: string;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tiersData, corridorsData] = await Promise.all([
        get<FeeTier[]>("/fees/admin/tiers"),
        get<Corridor[]>("/fx/corridors"),
      ]);
      setTiers(tiersData);
      setCorridors(corridorsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar comisiones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update simulator whenever calcAmount or direction changes
  useEffect(() => {
    const amt = parseFloat(calcAmount);
    if (isNaN(amt) || amt <= 0) {
      setCalcResult(null);
      return;
    }

    const corridor = corridors.find((c) => c.direction === calcDirection);
    const sellRate = corridor && corridor.fxRates[0] ? Number(corridor.fxRates[0].sellRate) : 3.75;

    // Direct calculation based on active tiers
    let penRef = amt;
    if (calcDirection === "EC_TO_PE") {
      penRef = amt * sellRate;
    }

    const activeTiers = tiers.filter((t) => t.active);
    let match = activeTiers.find(
      (t) => penRef >= Number(t.minAmountPen) && penRef <= Number(t.maxAmountPen),
    );
    if (!match && activeTiers.length > 0) {
      if (penRef > Number(activeTiers[activeTiers.length - 1].maxAmountPen)) {
        match = activeTiers[activeTiers.length - 1];
      } else {
        match = activeTiers[0];
      }
    }

    const feeInUsd = match ? Number(match.feeUsd) : 2;
    const feeInPen = match && match.feePen ? Number(match.feePen) : Number((feeInUsd * sellRate).toFixed(2));

    setCalcResult({
      feeAmount: calcDirection === "EC_TO_PE" ? feeInUsd : feeInPen,
      feeCurrency: calcDirection === "EC_TO_PE" ? "USD" : "PEN",
      feeUsd: feeInUsd,
      feePen: feeInPen,
      penReferenceAmount: Math.round(penRef * 100) / 100,
      tierDescription: match?.description ?? `Tramo S/. ${match?.minAmountPen} - S/. ${match?.maxAmountPen}`,
    });
  }, [calcAmount, calcDirection, tiers, corridors]);

  const handleOpenCreate = () => {
    setEditingTier(null);
    setMinAmountPen("");
    setMaxAmountPen("");
    setFeeUsd("");
    setFeePen("");
    setDescription("");
    setCorridorDirection("ALL");
    setActive(true);
    setOrderIndex(String(tiers.length + 1));
    setModalOpen(true);
  };

  const handleOpenEdit = (tier: FeeTier) => {
    setEditingTier(tier);
    setMinAmountPen(String(tier.minAmountPen));
    setMaxAmountPen(String(tier.maxAmountPen));
    setFeeUsd(String(tier.feeUsd));
    setFeePen(tier.feePen ? String(tier.feePen) : "");
    setDescription(tier.description ?? "");
    setCorridorDirection(tier.corridorDirection ?? "ALL");
    setActive(tier.active);
    setOrderIndex(String(tier.orderIndex));
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        minAmountPen: parseFloat(minAmountPen),
        maxAmountPen: parseFloat(maxAmountPen),
        feeUsd: parseFloat(feeUsd),
        feePen: feePen ? parseFloat(feePen) : parseFloat(feeUsd) * 3.75,
        corridorDirection: corridorDirection === "ALL" ? null : corridorDirection,
        description:
          description.trim() ||
          `De S/. ${minAmountPen} a S/. ${maxAmountPen} ($${feeUsd} USD)`,
        active,
        orderIndex: parseInt(orderIndex) || 0,
      };

      if (editingTier) {
        await patch(`/fees/admin/tiers/${editingTier.id}`, payload);
      } else {
        await post("/fees/admin/tiers", payload);
      }

      setModalOpen(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar el tramo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Está seguro de que desea eliminar este tramo de comisión?")) return;
    try {
      await del(`/fees/admin/tiers/${id}`);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  const handleToggleActive = async (tier: FeeTier) => {
    try {
      await patch(`/fees/admin/tiers/${tier.id}`, { active: !tier.active });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al actualizar estado");
    }
  };

  if (loading && tiers.length === 0) return <Spinner />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#475569] text-white p-6 rounded-2xl shadow-md border border-slate-600">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏷️</span>
            <h1 className="text-2xl font-black tracking-wide text-white">
              Tabla de Comisiones VALEX
            </h1>
          </div>
          <p className="text-xs text-[#00E5FF] mt-1 font-semibold">
            Esquema escalonado oficial con referencia al valor transformado a Soles (PEN)
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="bg-[#00E5FF] hover:bg-cyan-400 text-slate-900 font-extrabold shadow-lg flex items-center gap-2"
        >
          <span>➕</span>
          <span>Nuevo Tramo</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Simulator & Explanatory Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white border-slate-200 shadow-sm">
          <div className="p-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>🧮</span>
                <span>Simulador de Comisión en Tiempo Real</span>
              </h2>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Tasa Ventanilla: 1 USD = 3.75 PEN
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Corredor / Sentido
                </label>
                <select
                  value={calcDirection}
                  onChange={(e) => setCalcDirection(e.target.value as "EC_TO_PE" | "PE_TO_EC")}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-sm font-semibold text-slate-800 focus:border-[#00E5FF] focus:outline-none"
                >
                  <option value="EC_TO_PE">🇪🇨 Ecuador (USD) ➔ 🇵🇪 Perú (PEN)</option>
                  <option value="PE_TO_EC">🇵🇪 Perú (PEN) ➔ 🇪🇨 Ecuador (USD)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Monto a Enviar ({calcDirection === "EC_TO_PE" ? "USD" : "PEN"})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm font-bold text-slate-900 focus:border-[#00E5FF] focus:outline-none"
                    placeholder="Ej. 100"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">
                    {calcDirection === "EC_TO_PE" ? "USD" : "PEN"}
                  </span>
                </div>
              </div>
            </div>

            {calcResult && (
              <div className="mt-4 p-4 rounded-xl bg-slate-900 text-white border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Ref. Soles</div>
                  <div className="text-base font-extrabold text-amber-300">
                    S/. {calcResult.penReferenceAmount.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Tramo Aplicado</div>
                  <div className="text-xs font-bold text-slate-200 truncate" title={calcResult.tierDescription}>
                    {calcResult.tierDescription}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Comisión</div>
                  <div className="text-lg font-black text-[#00E5FF]">
                    {calcDirection === "EC_TO_PE"
                      ? `$${calcResult.feeUsd.toFixed(2)} USD`
                      : `S/. ${calcResult.feePen.toFixed(2)} PEN`}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Neto a Entregar</div>
                  <div className="text-base font-extrabold text-emerald-400">
                    {calcDirection === "EC_TO_PE"
                      ? `S/. ${((parseFloat(calcAmount) - calcResult.feeUsd) * 3.75).toFixed(2)}`
                      : `$${((parseFloat(calcAmount) - calcResult.feePen) / 3.75).toFixed(2)}`}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Policy Info Card */}
        <Card className="bg-[#475569]/10 border-slate-300">
          <div className="p-2 space-y-2 text-xs text-slate-700">
            <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
              <span>📌</span>
              <span>Regla de Cobro en Ambas Cajas</span>
            </div>
            <p>
              Los valores de la comisión tienen como base el <strong>monto transformado a Soles (PEN)</strong>.
            </p>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
              <div className="font-bold text-slate-800">✅ Cobro Simétrico:</div>
              <p className="text-[11px] text-slate-600">
                Tanto la caja de origen (Ecuador/Perú) como la caja de destino aplican la misma escala, asegurando transparencia contable y exactitud en los arqueos.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Fee Tiers Table */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>📋</span>
            <span>Escala Vigente de Comisiones ({tiers.length} tramos)</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-[#475569] text-xs uppercase font-bold text-white tracking-wider">
              <tr>
                <th className="px-6 py-3.5">#</th>
                <th className="px-6 py-3.5">Rango en Soles (PEN)</th>
                <th className="px-6 py-3.5">Comisión Base (USD)</th>
                <th className="px-6 py-3.5">Comisión Soles (PEN)</th>
                <th className="px-6 py-3.5">Corredor</th>
                <th className="px-6 py-3.5">Estado</th>
                <th className="px-6 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {tiers.map((tier, idx) => {
                return (
                  <tr
                    key={tier.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      !tier.active ? "opacity-60 bg-slate-50/50" : ""
                    }`}
                  >
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-extrabold text-slate-900 text-sm">
                        De S/. {Number(tier.minAmountPen).toLocaleString()} a S/. {Number(tier.maxAmountPen).toLocaleString()}
                      </div>
                      {tier.description && (
                        <div className="text-xs text-slate-500">{tier.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 font-black text-emerald-600 text-base bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        ${Number(tier.feeUsd).toFixed(2)} USD
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      S/. {tier.feePen ? Number(tier.feePen).toFixed(2) : (Number(tier.feeUsd) * 3.75).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700">
                        {tier.corridorDirection === "EC_TO_PE"
                          ? "🇪🇨 EC ➔ 🇵🇪 PE"
                          : tier.corridorDirection === "PE_TO_EC"
                            ? "🇵🇪 PE ➔ 🇪🇨 EC"
                            : "🌐 Todos los corredores"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(tier)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer transition-all ${
                          tier.active
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                      >
                        {tier.active ? "🟢 Activo" : "⚪ Inactivo"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button
                        variant="secondary"
                        onClick={() => handleOpenEdit(tier)}
                        className="text-xs font-bold py-1 px-2.5"
                      >
                        ✏️ Editar
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => handleDelete(tier.id)}
                        className="text-xs font-bold py-1 px-2.5"
                      >
                        🗑️
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {tiers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No hay tramos de comisión configurados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Create / Edit */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTier ? "Editar Tramo de Comisión" : "Nuevo Tramo de Comisión"}
      >
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Monto Mínimo (Soles PEN)"
              type="number"
              min="0"
              step="any"
              required
              value={minAmountPen}
              onChange={(e) => setMinAmountPen(e.target.value)}
              placeholder="Ej. 1"
            />
            <Input
              label="Monto Máximo (Soles PEN)"
              type="number"
              min="0"
              step="any"
              required
              value={maxAmountPen}
              onChange={(e) => setMaxAmountPen(e.target.value)}
              placeholder="Ej. 500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Comisión en USD ($)"
              type="number"
              min="0"
              step="any"
              required
              value={feeUsd}
              onChange={(e) => {
                setFeeUsd(e.target.value);
                const usd = parseFloat(e.target.value);
                if (!isNaN(usd)) {
                  setFeePen((usd * 3.75).toFixed(2));
                }
              }}
              placeholder="Ej. 1.00"
            />
            <Input
              label="Comisión en Soles (S/.)"
              type="number"
              min="0"
              step="any"
              value={feePen}
              onChange={(e) => setFeePen(e.target.value)}
              placeholder="Ej. 3.75"
            />
          </div>

          <Input
            label="Descripción del tramo (Opcional)"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej. De 1 a 500 soles ($1 USD)"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Aplica a Corredor
              </label>
              <select
                value={corridorDirection}
                onChange={(e) => setCorridorDirection(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm font-semibold text-slate-800 focus:border-[#00E5FF] focus:outline-none"
              >
                <option value="ALL">🌐 Todos los corredores</option>
                <option value="EC_TO_PE">🇪🇨 Ecuador ➔ 🇵🇪 Perú</option>
                <option value="PE_TO_EC">🇵🇪 Perú ➔ 🇪🇨 Ecuador</option>
              </select>
            </div>

            <Input
              label="Orden de visualización"
              type="number"
              min="0"
              value={orderIndex}
              onChange={(e) => setOrderIndex(e.target.value)}
              placeholder="1"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#00E5FF] focus:ring-[#00E5FF]"
            />
            <label htmlFor="active" className="text-sm font-semibold text-slate-700 cursor-pointer">
              Tramo activo para cobro en operaciones
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={saving}
              className="bg-[#475569] hover:bg-slate-700 text-white font-bold"
            >
              {editingTier ? "Guardar Cambios" : "Crear Tramo"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { get } from "@/lib/api";
import { STATUS_COLORS, STATUS_LABELS, fmtDate, fmtMoney } from "@/lib/format";
import type { CashAccount, Customer, LedgerAccount } from "@/lib/types";

interface AuditEntry {
  id: string;
  entity: string;
  action: string;
  entityId?: string;
  createdAt: string;
  actor: Customer;
}

interface DashboardData {
  totalTransfers: number;
  todayTransfers: number;
  todayVolumeSendAmount: number | null;
  byStatus: { status: string; _count: number }[];
  pendingCount: number;
  paymentBreakdown?: {
    cash: { count: number; totalUSD: number; totalPEN: number };
    bank: { count: number; totalUSD: number; totalPEN: number };
  };
  payoutBreakdown?: {
    cash: { count: number; totalUSD: number; totalPEN: number };
    yape: { count: number; totalPEN: number };
    bank: { count: number; totalUSD: number; totalPEN: number };
  };
  feesBreakdown?: {
    totalUSD: number;
    totalPEN: number;
    todayUSD: number;
    todayPEN: number;
  };
  corridorVolume?: {
    ecToPe: { count: number; sendUSD: number; receivePEN: number };
    peToEc: { count: number; sendPEN: number; receiveUSD: number };
  };
  bankAccounts?: {
    id: string;
    code: string;
    name: string;
    currency: string;
    balance: number;
  }[];
  cashAccounts: (CashAccount & { country: string })[];
  ledgerAccounts: LedgerAccount[];
  income: Record<string, number>;
  auditRecent: AuditEntry[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function run() {
      try {
        const d = await get<DashboardData>("/admin/dashboard");
        if (!ignore) setData(d);
      } catch (err) {
        if (!ignore)
          setError(err instanceof Error ? err.message : "Error al cargar panel");
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, []);

  if (!data && !error) return <Spinner />;
  if (error)
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  if (!data) return null;

  const cashSentUSD = data.paymentBreakdown?.cash.totalUSD ?? 0;
  const cashSentPEN = data.paymentBreakdown?.cash.totalPEN ?? 0;
  const bankSentUSD = data.paymentBreakdown?.bank.totalUSD ?? 0;
  const bankSentPEN = data.paymentBreakdown?.bank.totalPEN ?? 0;

  const totalFeesUSD = data.feesBreakdown?.totalUSD ?? (data.income["USD"] ?? 0);
  const totalFeesPEN = data.feesBreakdown?.totalPEN ?? (data.income["PEN"] ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#475569] text-white p-5 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <span>📊</span> Panel General y Control Operativo VALEX
          </h1>
          <p className="text-xs text-[#00E5FF] font-semibold mt-0.5">
            Arqueo global de efectivo, transferencias bancarias, comisiones recaudadas y liquidaciones
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="text-xs font-bold text-slate-900 bg-cyan-300 hover:bg-cyan-200"
            onClick={() => router.push("/transfer/new")}
          >
            💸 + Emitir VALEX
          </Button>
          <Button
            variant="primary"
            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
            onClick={() => router.push("/payout")}
          >
            📥 Caja Retiro (Entregas)
          </Button>
        </div>
      </div>

      {/* TOP KPI CARDS: DESGLOSE EFECTIVO VS TRANSFERENCIA VS COMISIONES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Recaudación en Efectivo */}
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50/70 to-white">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center justify-between">
              <span>💵 Enviado en Efectivo</span>
              <span className="bg-blue-200/80 text-blue-900 px-1.5 py-0.5 rounded text-[10px]">
                {data.paymentBreakdown?.cash.count ?? 0} Giros
              </span>
            </div>
            <div className="text-2xl font-black text-blue-950 pt-1">
              ${cashSentUSD.toFixed(2)} <span className="text-xs font-bold text-blue-700">USD</span>
            </div>
            {cashSentPEN > 0 && (
              <div className="text-sm font-bold text-blue-800">
                + S/. {cashSentPEN.toFixed(2)} <span className="text-[11px] font-normal">PEN</span>
              </div>
            )}
            <div className="text-[11px] text-slate-500 pt-1 border-t border-blue-100">
              Recaudado físicamente en ventanilla
            </div>
          </div>
        </Card>

        {/* 2. Recaudación por Transferencia Bancaria */}
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center justify-between">
              <span>🏦 Por Transferencia</span>
              <span className="bg-indigo-200/80 text-indigo-900 px-1.5 py-0.5 rounded text-[10px]">
                {data.paymentBreakdown?.bank.count ?? 0} Giros
              </span>
            </div>
            <div className="text-2xl font-black text-indigo-950 pt-1">
              ${bankSentUSD.toFixed(2)} <span className="text-xs font-bold text-indigo-700">USD</span>
            </div>
            {bankSentPEN > 0 && (
              <div className="text-sm font-bold text-indigo-800">
                + S/. {bankSentPEN.toFixed(2)} <span className="text-[11px] font-normal">PEN</span>
              </div>
            )}
            <div className="text-[11px] text-slate-500 pt-1 border-t border-indigo-100">
              Depositado en cuentas bancarias VALEX
            </div>
          </div>
        </Card>

        {/* 3. Comisiones Recaudadas */}
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center justify-between">
              <span>🏷️ Comisiones VALEX</span>
              <span className="bg-emerald-200/80 text-emerald-900 px-1.5 py-0.5 rounded text-[10px]">
                Margen Neto
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-950 pt-1">
              ${totalFeesUSD.toFixed(2)} <span className="text-xs font-bold text-emerald-700">USD</span>
            </div>
            <div className="text-sm font-bold text-emerald-800">
              + S/. {totalFeesPEN.toFixed(2)} <span className="text-[11px] font-normal">PEN</span>
            </div>
            <div className="text-[11px] text-slate-500 pt-1 border-t border-emerald-100">
              Hoy: ${data.feesBreakdown?.todayUSD.toFixed(2) ?? "0.00"} USD · S/. {data.feesBreakdown?.todayPEN.toFixed(2) ?? "0.00"} PEN
            </div>
          </div>
        </Card>

        {/* 4. Giros Pendientes por Liquidar */}
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50/70 to-white">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center justify-between">
              <span>⏳ Giros por Liquidar</span>
              <span className="bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded text-[10px]">
                En Tránsito
              </span>
            </div>
            <div className="text-2xl font-black text-amber-950 pt-1">
              {data.pendingCount} <span className="text-xs font-bold text-amber-700">Operaciones</span>
            </div>
            <div className="text-sm font-semibold text-amber-800">
              Total Giros: {data.totalTransfers}
            </div>
            <div className="text-[11px] text-slate-500 pt-1 border-t border-amber-100">
              Listas para validar código y entregar
            </div>
          </div>
        </Card>
      </div>

      {/* SECTION: ARQUEO DE CAJAS FÍSICAS Y CUENTAS BANCARIAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cajas Físicas en Efectivo */}
        <Card title="🏧 Bóvedas y Cajas Físicas en Efectivo (Ventanilla)">
          <div className="space-y-3">
            {data.cashAccounts.map((c) => (
              <div
                key={c.code}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>{c.country === "EC" || c.currency === "USD" ? "🇪🇨" : "🇵🇪"}</span>
                    <span>Caja {c.code} — {c.country === "EC" || c.currency === "USD" ? "Agencia Ecuador" : "Agencia Perú"}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Moneda Operativa: {c.currency}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-slate-900 font-mono">
                    {fmtMoney(c.balance, c.currency)}
                  </div>
                  <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Efectivo Disponible
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Cuentas Bancarias de la Empresa (Aumentadas por Transferencias) */}
        <Card title="🏦 Cuentas Bancarias de la Empresa (Fintech)">
          <div className="space-y-3">
            {(data.bankAccounts && data.bankAccounts.length > 0
              ? data.bankAccounts
              : [
                  { id: "1", code: "1010-EC", name: "Banco Pichincha (USD)", currency: "USD", balance: bankSentUSD },
                  { id: "2", code: "1011-EC", name: "Banco Guayaquil (USD)", currency: "USD", balance: 0 },
                  { id: "3", code: "1010-PE", name: "Banco BCP (PEN)", currency: "PEN", balance: bankSentPEN },
                ]
            ).map((b) => (
              <div
                key={b.code}
                className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/50 border border-indigo-200"
              >
                <div>
                  <div className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                    <span>🏦</span>
                    <span>{b.name}</span>
                  </div>
                  <div className="text-xs text-indigo-700 font-mono">
                    Cuenta: {b.code}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-indigo-950 font-mono">
                    {fmtMoney(b.balance, b.currency)}
                  </div>
                  <span className="text-[10px] font-bold uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    Saldo Bancario
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* SECTION: DESGLOSE DE ENTREGAS (PAYOUT) & CORREDORES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formas de Entrega */}
        <Card title="📤 Desglose por Forma de Retiro / Entrega">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2">
                <span>💵</span>
                <div>
                  <div className="font-bold text-slate-900">Efectivo en Ventanilla</div>
                  <div className="text-xs text-slate-500">{data.payoutBreakdown?.cash.count ?? 0} Operaciones</div>
                </div>
              </div>
              <div className="font-black text-slate-900">
                S/. {data.payoutBreakdown?.cash.totalPEN.toFixed(2) ?? "0.00"}
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2">
                <span>📱</span>
                <div>
                  <div className="font-bold text-emerald-950">Abono Yape (Perú)</div>
                  <div className="text-xs text-emerald-700">{data.payoutBreakdown?.yape.count ?? 0} Operaciones</div>
                </div>
              </div>
              <div className="font-black text-emerald-950">
                S/. {data.payoutBreakdown?.yape.totalPEN.toFixed(2) ?? "0.00"}
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2">
                <span>🏦</span>
                <div>
                  <div className="font-bold text-blue-950">Cuenta Bancaria</div>
                  <div className="text-xs text-blue-700">{data.payoutBreakdown?.bank.count ?? 0} Operaciones</div>
                </div>
              </div>
              <div className="font-black text-blue-950">
                S/. {data.payoutBreakdown?.bank.totalPEN.toFixed(2) ?? "0.00"}
              </div>
            </div>
          </div>
        </Card>

        {/* Volumen por Corredor */}
        <Card title="🌐 Volumen por Corredor Bilateral">
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1">
              <div className="font-bold text-blue-950 flex items-center justify-between">
                <span>🇪🇨 Ecuador → 🇵🇪 Perú</span>
                <span className="text-xs bg-blue-200 text-blue-900 px-2 py-0.5 rounded font-bold">
                  {data.corridorVolume?.ecToPe.count ?? 0} Giros
                </span>
              </div>
              <div className="text-xs text-slate-600 flex justify-between pt-1">
                <span>Enviado:</span>
                <span className="font-bold text-slate-900">${data.corridorVolume?.ecToPe.sendUSD.toFixed(2) ?? "0.00"} USD</span>
              </div>
              <div className="text-xs text-emerald-800 flex justify-between">
                <span>Entregado en Destino:</span>
                <span className="font-black">S/. {data.corridorVolume?.ecToPe.receivePEN.toFixed(2) ?? "0.00"} PEN</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
              <div className="font-bold text-amber-950 flex items-center justify-between">
                <span>🇵🇪 Perú → 🇪🇨 Ecuador</span>
                <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">
                  {data.corridorVolume?.peToEc.count ?? 0} Giros
                </span>
              </div>
              <div className="text-xs text-slate-600 flex justify-between pt-1">
                <span>Enviado:</span>
                <span className="font-bold text-slate-900">S/. {data.corridorVolume?.peToEc.sendPEN.toFixed(2) ?? "0.00"} PEN</span>
              </div>
              <div className="text-xs text-emerald-800 flex justify-between">
                <span>Entregado en Destino:</span>
                <span className="font-black">${data.corridorVolume?.peToEc.receiveUSD.toFixed(2) ?? "0.00"} USD</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Estado de Operaciones */}
        <Card title="📋 Estado de Operaciones">
          <div className="space-y-2">
            {data.byStatus.map((s) => (
              <div
                key={s.status}
                className="flex items-center justify-between text-sm py-1 border-b border-slate-100"
              >
                <Badge className={STATUS_COLORS[s.status]}>
                  {STATUS_LABELS[s.status] ?? s.status}
                </Badge>
                <span className="font-bold text-slate-800">
                  {s._count}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* RECENT AUDIT LOG */}
      <Card title="🔍 Registro de Auditoría y Trazabilidad en Vivo">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 font-bold bg-slate-50">
                <th className="py-2.5 px-3">Fecha y Hora</th>
                <th className="py-2.5 px-3">Entidad</th>
                <th className="py-2.5 px-3">Acción Registrada</th>
                <th className="py-2.5 px-3">Operador / Usuario</th>
              </tr>
            </thead>
            <tbody>
              {data.auditRecent.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono text-slate-600">{fmtDate(a.createdAt)}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-800">
                    {a.entity}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-blue-900">{a.action}</td>
                  <td className="py-2.5 px-3 text-slate-700">
                    {a.actor?.fullName ?? "Sistema Automático"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

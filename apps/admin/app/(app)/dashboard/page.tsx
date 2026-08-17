"use client";

import { useEffect, useState } from "react";
import { Badge, Card, Spinner } from "@/components/ui";
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
  cashAccounts: (CashAccount & { country: string })[];
  ledgerAccounts: LedgerAccount[];
  income: Record<string, number>;
  auditRecent: AuditEntry[];
}

export default function DashboardPage() {
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
          setError(err instanceof Error ? err.message : "Error al cargar");
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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Panel de control</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card title="Transferencias totales">
          <div className="text-2xl font-bold text-slate-900">
            {data.totalTransfers}
          </div>
        </Card>
        <Card title="Hoy">
          <div className="text-2xl font-bold text-slate-900">
            {data.todayTransfers}
          </div>
          <div className="text-xs text-slate-500">
            Volumen {fmtMoney(data.todayVolumeSendAmount ?? 0, "USD")}
          </div>
        </Card>
        <Card title="Pendientes">
          <div className="text-2xl font-bold text-amber-600">
            {data.pendingCount}
          </div>
        </Card>
        <Card title="Ingresos por comisión">
          <div className="text-lg font-bold text-emerald-600">
            {Object.entries(data.income)
              .map(([cur, v]) => fmtMoney(v, cur))
              .join(" · ") || "—"}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card title="Operaciones por estado">
          <div className="space-y-2">
            {data.byStatus.map((s) => (
              <div
                key={s.status}
                className="flex items-center justify-between text-sm"
              >
                <Badge className={STATUS_COLORS[s.status]}>
                  {STATUS_LABELS[s.status] ?? s.status}
                </Badge>
                <span className="font-semibold text-slate-800">
                  {s._count}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Cajas en efectivo">
          <div className="space-y-2">
            {data.cashAccounts.map((c) => (
              <div
                key={c.code}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-600">
                  {c.code} · {c.country}
                </span>
                <span className="font-semibold text-slate-800">
                  {fmtMoney(c.balance, c.currency)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Auditoría reciente">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
              <th className="py-2">Fecha</th>
              <th className="py-2">Entidad</th>
              <th className="py-2">Acción</th>
              <th className="py-2">Usuario</th>
            </tr>
          </thead>
          <tbody>
            {data.auditRecent.map((a) => (
              <tr key={a.id} className="border-b border-slate-50">
                <td className="py-2">{fmtDate(a.createdAt)}</td>
                <td className="py-2 font-medium text-slate-800">
                  {a.entity}
                </td>
                <td className="py-2">{a.action}</td>
                <td className="py-2 text-slate-500">
                  {a.actor?.fullName ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Badge, Card, Spinner } from "@/components/ui";
import { get } from "@/lib/api";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { CashAccount, CashSession } from "@/lib/types";

export default function CashPage() {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function run() {
      try {
        const [accs, sess] = await Promise.all([
          get<CashAccount[]>("/cash/accounts"),
          get<CashSession[]>("/cash/sessions"),
        ]);
        if (!ignore) setAccounts(accs);
        if (!ignore) setSessions(sess);
      } catch {
        /* noop */
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Cajas en efectivo</h1>

      <div className="grid grid-cols-2 gap-4">
        {accounts.map((a) => (
          <Card key={a.id} title={a.code}>
            <div className="text-2xl font-bold text-slate-900">
              {fmtMoney(a.balance, a.currency)}
            </div>
            <div className="text-xs text-slate-500">
              {a.office?.name ? `${a.office.name} · ` : ""}
              {a.office?.country?.name ?? (typeof a.country === "object" ? a.country?.name : a.country) ?? "Ecuador"}{" "}
              ({a.office?.country?.code ?? (typeof a.country === "object" ? a.country?.code : a.country) ?? "EC"})
            </div>
          </Card>
        ))}
      </div>

      <Card title="Sesiones de caja">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
              <th className="py-2">Apertura</th>
              <th className="py-2">Esperado</th>
              <th className="py-2">Contado</th>
              <th className="py-2">Diferencia</th>
              <th className="py-2">Estado</th>
              <th className="py-2">Cierre</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-slate-50">
                <td className="py-2">{fmtDate(s.openedAt)}</td>
                <td className="py-2">
                  {fmtMoney(s.expectedBalance, s.cashAccount?.currency ?? "USD")}
                </td>
                <td className="py-2">
                  {s.actualBalance != null
                    ? fmtMoney(s.actualBalance, s.cashAccount?.currency ?? "USD")
                    : "—"}
                </td>
                <td className="py-2">
                  {s.discrepancy != null
                    ? fmtMoney(s.discrepancy, s.cashAccount?.currency ?? "USD")
                    : "—"}
                </td>
                <td className="py-2">
                  <Badge
                    className={
                      s.status === "OPEN"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-600"
                    }
                  >
                    {s.status === "OPEN" ? "Abierta" : "Cerrada"}
                  </Badge>
                </td>
                <td className="py-2">
                  {s.closedAt ? fmtDate(s.closedAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Badge, Card, Spinner } from "@/components/ui";
import { get } from "@/lib/api";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { LedgerAccount, LedgerEntry } from "@/lib/types";

export default function LedgerPage() {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function run() {
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (selectedAccount) params.set("accountId", selectedAccount);
        const accs = await get<LedgerAccount[]>("/ledger/accounts");
        if (!ignore) setAccounts(accs);
        const es = await get<LedgerEntry[]>(`/ledger/entries?${params}`);
        if (!ignore) setEntries(es);
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
  }, [selectedAccount]);

  if (loading && entries.length === 0) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Contabilidad</h1>

      <Card title="Plan de cuentas">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
              <th className="py-2">Código</th>
              <th className="py-2">Cuenta</th>
              <th className="py-2">Tipo</th>
              <th className="py-2">Moneda</th>
              <th className="py-2">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr
                key={a.id}
                className={`cursor-pointer border-b border-slate-50 hover:bg-slate-50 ${selectedAccount === a.id ? "bg-blue-50" : ""}`}
                onClick={() =>
                  setSelectedAccount(selectedAccount === a.id ? "" : a.id)
                }
              >
                <td className="py-2 font-mono font-medium">{a.code}</td>
                <td className="py-2">{a.name}</td>
                <td className="py-2">
                  <Badge className="bg-slate-100 text-slate-700">
                    {a.type}
                  </Badge>
                </td>
                <td className="py-2">{a.currency}</td>
                <td className="py-2 font-medium">
                  {fmtMoney(a.balance, a.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={selectedAccount ? "Movimientos de la cuenta" : "Asientos recientes"}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
              <th className="py-2">Fecha</th>
              <th className="py-2">Cuenta</th>
              <th className="py-2">Lado</th>
              <th className="py-2">Monto</th>
              <th className="py-2">Descripción</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-slate-50">
                <td className="py-2 text-slate-500">{fmtDate(e.createdAt)}</td>
                <td className="py-2 font-mono text-xs">
                  {e.account.code} · {e.account.name}
                </td>
                <td className="py-2">
                  <Badge
                    className={
                      e.side === "DEBIT"
                        ? "bg-red-100 text-red-800"
                        : "bg-emerald-100 text-emerald-800"
                    }
                  >
                    {e.side}
                  </Badge>
                </td>
                <td className="py-2 font-medium">
                  {fmtMoney(e.amount, e.account.currency)}
                </td>
                <td className="py-2 text-slate-500">{e.description ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

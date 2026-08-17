"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Select, Spinner } from "@/components/ui";
import { get, post } from "@/lib/api";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { CashAccount, Settlement, Transfer } from "@/lib/types";

interface TreasuryOverview {
  cash: (CashAccount & { country: string; officeName?: string })[];
  bankAccounts: unknown[];
  ledgerAccounts: unknown[];
  pendingTransfers: Transfer[];
  recentSettlements: Settlement[];
}

export default function TreasuryPage() {
  const [overview, setOverview] = useState<TreasuryOverview | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const [ov, st] = await Promise.all([
      get<TreasuryOverview>("/treasury/overview"),
      get<Settlement[]>("/treasury/settlements"),
    ]);
    setOverview(ov);
    setSettlements(st);
  }, []);

  useEffect(() => {
    let ignore = false;
    async function run() {
      try {
        await load();
      } catch (err) {
        if (!ignore)
          setError(err instanceof Error ? err.message : "Error al cargar");
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, [load]);

  const createSettlement = async (transferId: string) => {
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      const t = overview?.pendingTransfers.find((x) => x.id === transferId);
      if (!t) return;
      await post("/treasury/settlements", {
        transferId,
        amount: t.receiveAmount,
        currency: t.receiveCurrency,
      });
      setSuccess(`Liquidación registrada para ${t.reference}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al liquidar");
    } finally {
      setWorking(false);
    }
  };

  if (!overview) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Tesorería</h1>

      {error && <Alert>{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      <div className="grid grid-cols-2 gap-4">
        {overview.cash.map((c) => (
          <Card key={c.code} title={c.code}>
            <div className="text-2xl font-bold text-slate-900">
              {fmtMoney(c.balance, c.currency)}
            </div>
            <div className="text-xs text-slate-500">{c.country}</div>
          </Card>
        ))}
      </div>

      <Card
        title="Transferencias pendientes de liquidación"
        action={
          <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Seleccionar…</option>
            {overview.pendingTransfers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.reference} — {t.beneficiary.fullName} —{" "}
                {fmtMoney(t.receiveAmount, t.receiveCurrency)}
              </option>
            ))}
          </Select>
        }
      >
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {overview.pendingTransfers.length} en{" "}
            {overview.pendingTransfers.length > 0 ? "SETTLEMENT_PENDING" : ""}
          </div>
          <Button
            onClick={() => selected && createSettlement(selected)}
            disabled={!selected}
            loading={working}
          >
            Registrar liquidación
          </Button>
        </div>
      </Card>

      <Card title="Liquidaciones recientes">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
              <th className="py-2">Fecha</th>
              <th className="py-2">Referencia</th>
              <th className="py-2">Monto</th>
              <th className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(settlements.length > 0 ? settlements : overview.recentSettlements).map(
              (s) => (
                <tr key={s.id} className="border-b border-slate-50">
                  <td className="py-2">{fmtDate(s.createdAt)}</td>
                  <td className="py-2 font-mono font-medium">
                    {s.transfer?.reference ?? "—"}
                  </td>
                  <td className="py-2">
                    {fmtMoney(s.amount, s.currency)}
                  </td>
                  <td className="py-2">{s.status}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

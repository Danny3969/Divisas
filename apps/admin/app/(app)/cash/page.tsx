"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Input, Select, Spinner } from "@/components/ui";
import { get, post } from "@/lib/api";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { CashAccount, CashSession } from "@/lib/types";

export default function CashPage() {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal para aperturar / fijar saldo inicial
  const [showModal, setShowModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [initialBalance, setInitialBalance] = useState("1000");

  const loadData = async () => {
    try {
      const [accs, sess] = await Promise.all([
        get<CashAccount[]>("/cash/accounts"),
        get<CashSession[]>("/cash/sessions"),
      ]);
      setAccounts(accs);
      setSessions(sess);
      if (accs.length > 0 && !selectedAccountId) setSelectedAccountId(accs[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos de caja");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenSessionAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      const acc = accounts.find((a) => a.id === selectedAccountId);
      const res = await post<CashSession>("/cash/sessions", {
        cashAccountId: selectedAccountId,
        openingBalance: Number(initialBalance),
      });
      setSuccess(
        `Monto inicial asignado con éxito: ${fmtMoney(res.openingBalance, acc?.currency ?? "USD")} para la caja de ${acc?.currency === "USD" ? "Ecuador" : "Perú"}.`
      );
      setShowModal(false);
      setInitialBalance("1000");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al asignar saldo inicial de caja");
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Gestión y Control de Cajas en Efectivo</h1>
          <p className="text-xs text-slate-500">
            Asignación de fondos de apertura, arqueos y supervisión en tiempo real para Ecuador y Perú.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} variant="primary" className="font-bold">
          ➕ Asignar / Aperturar Saldo Inicial de Caja
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((a) => {
          const countryLabel =
            a.currency === "USD" || a.office?.country?.code === "EC" ? "Ecuador" : "Perú";
          const activeSession = sessions.find(
            (s) => s.cashAccountId === a.id && s.status === "OPEN"
          );

          return (
            <Card key={a.id} title={`Caja ${a.code} — Agencia ${countryLabel}`}>
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-500 font-semibold uppercase">Saldo Disponible:</span>
                  <span className="text-2xl font-black text-slate-900">
                    {fmtMoney(a.balance, a.currency)}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Estado de Turno:</span>
                    {activeSession ? (
                      <Badge className="bg-emerald-100 text-emerald-800 font-bold">
                        Sesión Abierta
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-200 text-slate-600">
                        Caja Cerrada
                      </Badge>
                    )}
                  </div>
                  {activeSession && (
                    <div className="flex justify-between border-t border-slate-200 pt-1 text-slate-800">
                      <span className="font-semibold">Monto de Apertura Asignado:</span>
                      <span className="font-bold text-emerald-700">
                        {fmtMoney(activeSession.openingBalance, a.currency)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="📜 Historial de Sesiones de Caja y Fondos de Apertura">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                <th className="py-2.5">Fecha Apertura</th>
                <th className="py-2.5">Agencia</th>
                <th className="py-2.5">Monto Apertura</th>
                <th className="py-2.5">Saldo Esperado</th>
                <th className="py-2.5">Contado en Arqueo</th>
                <th className="py-2.5">Diferencia</th>
                <th className="py-2.5">Estado</th>
                <th className="py-2.5">Fecha Cierre</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-slate-400">
                    Sin sesiones de caja registradas. Asigne un saldo inicial arriba para comenzar.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const curr = s.cashAccount?.currency ?? "USD";
                  const agency = curr === "USD" ? "Ecuador" : "Perú";
                  return (
                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2.5 text-xs">{fmtDate(s.openedAt)}</td>
                      <td className="py-2.5 font-semibold text-slate-800">{agency}</td>
                      <td className="py-2.5 font-bold text-emerald-700">
                        {fmtMoney(s.openingBalance, curr)}
                      </td>
                      <td className="py-2.5">{fmtMoney(s.expectedBalance ?? s.openingBalance, curr)}</td>
                      <td className="py-2.5">
                        {s.actualBalance != null ? fmtMoney(s.actualBalance, curr) : "—"}
                      </td>
                      <td className="py-2.5">
                        {s.discrepancy != null ? fmtMoney(s.discrepancy, curr) : "—"}
                      </td>
                      <td className="py-2.5">
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
                      <td className="py-2.5 text-xs">{s.closedAt ? fmtDate(s.closedAt) : "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Asignar Saldo Inicial de Caja */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900">💵 Asignar / Aperturar Fondo Inicial de Caja</h2>
            <p className="text-xs text-slate-500">
              Defina la cantidad inicial en efectivo con la que abrirá turno la caja seleccionada.
            </p>
            <form onSubmit={handleOpenSessionAdmin} className="space-y-4">
              <Select
                label="Caja / Agencia Destino"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                {accounts.map((a) => {
                  const label = a.currency === "USD" ? "Ecuador (USD)" : "Perú (PEN)";
                  return (
                    <option key={a.id} value={a.id}>
                      Caja {a.code} — Agencia {label}
                    </option>
                  );
                })}
              </Select>

              <Input
                label="Monto de Apertura (Fondo Fijo Inicial)"
                type="number"
                min="0"
                step="0.01"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="Ej: 1000.00"
                required
              />

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" loading={working} className="flex-1 font-bold">
                  💾 Guardar e Iniciar Caja
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

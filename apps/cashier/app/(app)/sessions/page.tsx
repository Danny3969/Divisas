"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Select,
} from "@/components/ui";
import { get, patch, post } from "@/lib/api";
import { fmtDate, fmtMoney } from "@/lib/format";
import { useCashAccounts } from "@/lib/hooks";
import type { CashSession } from "@/lib/types";

export default function SessionsPage() {
  const { accounts, refresh: refreshAccounts } = useCashAccounts();
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [selected, setSelected] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const refreshSessions = useCallback(async () => {
    try {
      const data = await get<CashSession[]>("/cash/sessions");
      setSessions(data);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function run() {
      try {
        const data = await get<CashSession[]>("/cash/sessions");
        if (!ignore) setSessions(data);
      } catch {
        /* noop */
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, []);

  const openSession = async () => {
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      const accId = selected || accounts[0]?.id;
      if (!accId) {
        setError("No hay cajas disponibles.");
        return;
      }
      const s = await post<CashSession>("/cash/sessions", {
        cashAccountId: accId,
        openingBalance: Number(openingBalance),
      });
      setSuccess(`Sesión ${s.id.slice(0, 8)} abierta con ${fmtMoney(s.openingBalance, "USD")}.`);
      setOpeningBalance("0");
      await refreshSessions();
      await refreshAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al abrir sesión");
    } finally {
      setWorking(false);
    }
  };

  const closeSession = async (id: string, actualBalance: number) => {
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      const s = await patch<CashSession>(`/cash/sessions/${id}/close`, {
        actualBalance,
      });
      const diff = Number(s.discrepancy);
      setSuccess(
        diff === 0
          ? `Cierre OK. Contado ${fmtMoney(actualBalance, "USD")}.`
          : `Cierre con diferencia de ${fmtMoney(diff, "USD")}. Se registró la discrepancia.`,
      );
      await refreshSessions();
      await refreshAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cerrar");
    } finally {
      setWorking(false);
    }
  };

  const activeSession = sessions.find((s) => s.status === "OPEN");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Caja y sesiones</h1>

      {error && <Alert>{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      <div className="grid grid-cols-2 gap-4">
        {accounts.map((a) => {
          const open = sessions.find(
            (s) => s.cashAccountId === a.id && s.status === "OPEN",
          );
          return (
            <Card key={a.id} title={a.code}>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Saldo</span>
                  <span className="font-semibold text-slate-800">
                    {fmtMoney(a.balance, a.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Sesión</span>
                  {open ? (
                    <Badge className="bg-emerald-100 text-emerald-800">
                      Abierta
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-200 text-slate-600">
                      Cerrada
                    </Badge>
                  )}
                </div>
                {open && (
                  <div className="text-xs text-slate-400">
                    Apertura {fmtMoney(open.openingBalance, a.currency)} ·{" "}
                    {fmtDate(open.openedAt)}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {!activeSession ? (
        <Card title="🌅 INICIO DE CAJA (Apertura de Turno Diario)">
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Registra el monto inicial de efectivo con el que abre la caja la cajera al comenzar la jornada.
            </p>
            <Select
              label="Caja a Aperturar"
              value={selected || accounts[0]?.id || ""}
              onChange={(e) => setSelected(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} ({a.currency}) — Saldo disponible: {fmtMoney(a.balance, a.currency)}
                </option>
              ))}
            </Select>
            <Input
              label="Saldo de apertura (Efectivo físico contado en caja)"
              type="number"
              min="0"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0.00"
            />
            <Button onClick={openSession} loading={working} className="w-full font-bold">
              🌅 Registrar Inicio de Caja
            </Button>
          </div>
        </Card>
      ) : (
        <Card
          title="🌆 CIERRE DE CAJA (Arqueo y Cuadre Final de Turno)"
          action={
            <Badge className="bg-emerald-100 text-emerald-800">
              En curso desde {fmtDate(activeSession.openedAt)}
            </Badge>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Monto de Apertura:</span>
                <span className="font-semibold">{fmtMoney(activeSession.openingBalance, "USD")}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="text-slate-800 font-bold">Saldo Esperado según el Sistema:</span>
                <span className="font-extrabold text-blue-700 text-base">
                  {fmtMoney(activeSession.expectedBalance, "USD")}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Al finalizar el turno, la cajera debe contar todo el efectivo físico en billetes y monedas e ingresar el total para realizar el arqueo final.
            </p>

            <CloseButton
              session={activeSession}
              onClose={closeSession}
              working={working}
            />
          </div>
        </Card>
      )}

      <Card title="Historial de sesiones">
        {sessions.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">
            Sin sesiones registradas.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="py-2">Estado</th>
                <th className="py-2">Apertura</th>
                <th className="py-2">Esperado</th>
                <th className="py-2">Contado</th>
                <th className="py-2">Diferencia</th>
                <th className="py-2">Cierre</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-slate-50">
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
                  <td className="py-2">{fmtDate(s.openedAt)}</td>
                  <td className="py-2">{fmtMoney(s.expectedBalance, "USD")}</td>
                  <td className="py-2">
                    {s.actualBalance != null
                      ? fmtMoney(s.actualBalance, "USD")
                      : "—"}
                  </td>
                  <td className="py-2">
                    {s.discrepancy != null
                      ? fmtMoney(s.discrepancy, "USD")
                      : "—"}
                  </td>
                  <td className="py-2">
                    {s.closedAt ? fmtDate(s.closedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function CloseButton({
  session,
  onClose,
  working,
}: {
  session: CashSession;
  onClose: (id: string, amount: number) => void;
  working: boolean;
}) {
  const [amount, setAmount] = useState("");
  const expected = Number(session.expectedBalance || 0);
  const counted = amount !== "" ? Number(amount) : null;
  const diff = counted != null ? counted - expected : null;

  return (
    <div className="space-y-3">
      <Input
        label="Monto contado al arqueo (Efectivo físico en caja)"
        type="number"
        min="0"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={session.expectedBalance}
      />
      {diff != null && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold ${
            Math.abs(diff) < 0.01
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-amber-50 text-amber-900 border border-amber-200"
          }`}
        >
          {Math.abs(diff) < 0.01
            ? "✅ Arqueo perfecto: Sin diferencia entre dinero físico y sistema."
            : `⚠️ Diferencia detectada: ${diff > 0 ? "+" : ""}${diff.toFixed(2)} USD (${diff > 0 ? "Sobrante" : "Faltante"})`}
        </div>
      )}
      <Button
        onClick={() => onClose(session.id, Number(amount))}
        loading={working}
        disabled={amount === ""}
        className="w-full font-bold"
      >
        🌆 Realizar Arqueo y Cerrar Caja
      </Button>
    </div>
  );
}

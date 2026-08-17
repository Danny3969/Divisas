"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Input } from "@/components/ui";
import { get, patch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate, fmtMoney } from "@/lib/format";
import { useCashAccounts } from "@/lib/hooks";
import type { CashSession } from "@/lib/types";

export default function SessionsPage() {
  const { user } = useAuth();
  const { accounts, refresh: refreshAccounts } = useCashAccounts();
  const [sessions, setSessions] = useState<CashSession[]>([]);
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
          ? `Cierre OK. Contado ${fmtMoney(actualBalance, s.cashAccount?.currency ?? "USD")}.`
          : `Cierre con diferencia de ${fmtMoney(diff, s.cashAccount?.currency ?? "USD")}. Se registró la discrepancia.`,
      );
      await refreshSessions();
      await refreshAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cerrar sesión");
    } finally {
      setWorking(false);
    }
  };

  // Orden dinámico de tarjetas: Si el usuario es de Perú, MAIN-PE-01 va PRIMERO. Si es de Ecuador, MAIN-EC-01 va PRIMERO.
  const isPeruUser =
    user?.officeId === "office-pe" ||
    user?.office?.country?.code === "PE" ||
    user?.office?.name?.includes("Perú") ||
    user?.email?.includes(".pe");

  const sortedAccounts = [...accounts].sort((a, b) => {
    const aIsPe = a.code.includes("PE") || a.currency === "PEN";
    const bIsPe = b.code.includes("PE") || b.currency === "PEN";
    if (isPeruUser) {
      if (aIsPe && !bIsPe) return -1;
      if (!aIsPe && bIsPe) return 1;
    } else {
      if (!aIsPe && bIsPe) return -1;
      if (aIsPe && !bIsPe) return 1;
    }
    return 0;
  });

  const activeSession = sessions.find((s) => s.status === "OPEN");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Caja y sesiones</h1>

      {error && <Alert>{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      {/* Tarjetas de Cajas ordenadas según el país del cajero logueado */}
      <div className="grid grid-cols-2 gap-4">
        {sortedAccounts.map((a) => {
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
                    <Badge className="bg-emerald-100 text-emerald-800 font-bold">
                      Abierta
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-200 text-slate-600">
                      Cerrada
                    </Badge>
                  )}
                </div>
                {open && (
                  <div className="text-xs text-slate-500 font-medium">
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
        <Card title="🔐 ESTADO DE CAJA: APERTURA EXCLUSIVA POR ADMINISTRACIÓN">
          <div className="p-6 text-center space-y-3">
            <div className="text-4xl">🔒</div>
            <h3 className="text-base font-bold text-slate-800">
              La caja aún no ha sido aperturada por el Administrador.
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              De acuerdo con los controles de seguridad del sistema, la apertura de turno y asignación del saldo inicial en efectivo se realiza únicamente desde la <strong>Consola de Administración</strong>.
            </p>
            <div className="inline-block bg-amber-50 border border-amber-200 text-amber-900 text-xs px-4 py-2 rounded-lg font-semibold">
              ℹ️ Solicite a su Administrador realizar la apertura en la sección "Cajas" del Panel Admin.
            </div>
          </div>
        </Card>
      ) : (
        <Card
          title="🌆 CIERRE DE CAJA (Arqueo y Cuadre Final de Turno)"
          action={
            <Badge className="bg-emerald-100 text-emerald-800 font-bold">
              En curso desde {fmtDate(activeSession.openedAt)}
            </Badge>
          }
        >
          <div className="space-y-4">
            {/* Destacado del Monto de Apertura */}
            <div className="bg-slate-900 text-white rounded-xl p-4 shadow border-l-4 border-amber-400 space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span>💵</span> MONTO DE APERTURA REGISTRADO PARA EL TURNO:
              </div>
              <div className="text-2xl font-black text-emerald-400">
                {fmtMoney(
                  activeSession.openingBalance,
                  activeSession.cashAccount?.currency ?? "USD",
                )}
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                Apertura autorizada el {fmtDate(activeSession.openedAt)}
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 text-sm space-y-2">
              <div className="flex justify-between border-t border-slate-200 pt-1">
                <span className="text-slate-800 font-bold">
                  Saldo Esperado según el Sistema:
                </span>
                <span className="font-extrabold text-blue-700 text-base">
                  {fmtMoney(
                    activeSession.expectedBalance ?? activeSession.openingBalance,
                    activeSession.cashAccount?.currency ?? "USD",
                  )}
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
                <th className="py-2">Fecha Apertura</th>
                <th className="py-2">Monto Apertura</th>
                <th className="py-2">Esperado</th>
                <th className="py-2">Contado</th>
                <th className="py-2">Diferencia</th>
                <th className="py-2">Cierre</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const curr = s.cashAccount?.currency ?? "USD";
                return (
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
                    <td className="py-2 text-xs">{fmtDate(s.openedAt)}</td>
                    <td className="py-2 font-bold text-slate-900">
                      {fmtMoney(s.openingBalance, curr)}
                    </td>
                    <td className="py-2">
                      {fmtMoney(s.expectedBalance ?? s.openingBalance, curr)}
                    </td>
                    <td className="py-2">
                      {s.actualBalance != null
                        ? fmtMoney(s.actualBalance, curr)
                        : "—"}
                    </td>
                    <td className="py-2">
                      {s.discrepancy != null
                        ? fmtMoney(s.discrepancy, curr)
                        : "—"}
                    </td>
                    <td className="py-2 text-xs">
                      {s.closedAt ? fmtDate(s.closedAt) : "—"}
                    </td>
                  </tr>
                );
              })}
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
  const expected = Number(session.expectedBalance || session.openingBalance || 0);
  const counted = amount !== "" ? Number(amount) : null;
  const diff = counted != null ? counted - expected : null;
  const curr = session.cashAccount?.currency ?? "USD";

  return (
    <div className="space-y-3">
      <Input
        label="Monto contado al arqueo (Efectivo físico en caja)"
        type="number"
        min="0"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={String(expected)}
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
            : `⚠️ Diferencia detectada: ${diff > 0 ? "+" : ""}${diff.toFixed(2)} ${curr} (${diff > 0 ? "Sobrante" : "Faltante"})`}
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

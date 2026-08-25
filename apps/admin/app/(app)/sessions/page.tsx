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

  // Identificación del país de la ventanilla autenticada
  const isPeruUser =
    user?.officeId === "office-pe" ||
    user?.office?.country?.code === "PE" ||
    user?.office?.name?.includes("Perú") ||
    user?.email?.includes(".pe");

  // Filtrar EXCLUSIVAMENTE la caja asignada a la sede del cajero autenticado (Seguridad y Privacidad por Sede)
  const myAccounts = accounts.filter((a) => {
    const isPeAccount = a.code.includes("PE") || a.currency === "PEN";
    return isPeruUser ? isPeAccount : !isPeAccount;
  });

  const displayedAccounts = myAccounts.length > 0 ? myAccounts : accounts;
  const currentAccount = displayedAccounts[0];

  // La sesión activa se filtra ESTRICTAMENTE por la caja asignada a esta ventanilla
  const activeSession = sessions.find(
    (s) => s.cashAccountId === currentAccount?.id && s.status === "OPEN"
  );

  const closeSession = async (id: string, actualBalance: number) => {
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      const s = await patch<CashSession>(`/cash/sessions/${id}/close`, {
        actualBalance,
      });
      const diff = Number(s.discrepancy);
      const curr = currentAccount?.currency ?? "USD";
      setSuccess(
        diff === 0
          ? `Cierre OK. Contado ${fmtMoney(actualBalance, curr)}.`
          : `Cierre con diferencia de ${fmtMoney(diff, curr)}. Se registró la discrepancia.`,
      );
      await refreshSessions();
      await refreshAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cerrar sesión");
    } finally {
      setWorking(false);
    }
  };

  const agencyLabel = isPeruUser ? "Perú" : "Ecuador";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Caja y Sesión de Turno — Sede {agencyLabel}
          </h1>
          <p className="text-xs text-slate-500">
            Gestión y control de efectivo exclusivo para la caja asignada a la sede {agencyLabel}.
          </p>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      {/* Tarjeta Exclusiva de la Caja de esta Ventanilla */}
      <div className="grid grid-cols-1 gap-4">
        {displayedAccounts.map((a) => {
          const open = sessions.find(
            (s) => s.cashAccountId === a.id && s.status === "OPEN"
          );
          const country = a.currency === "USD" ? "Ecuador" : "Perú";

          return (
            <div
              key={a.id}
              className="rounded-xl p-5 bg-white border-2 border-blue-600 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏦</span>
                  <span className="font-extrabold text-slate-900 text-base">
                    Caja {a.code} — Agencia {country}
                  </span>
                </div>
                <Badge className="bg-blue-100 text-blue-800 font-bold px-3 py-1">
                  Caja Asignada
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-1 text-sm">
                <div>
                  <span className="text-slate-500 text-xs block">Saldo Actual en Caja</span>
                  <span className="font-black text-slate-900 text-lg">
                    {fmtMoney(a.balance, a.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">Estado de Turno</span>
                  {open ? (
                    <Badge className="bg-emerald-100 text-emerald-800 font-extrabold mt-1">
                      🟢 Sesión Abierta
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-200 text-slate-600 font-bold mt-1">
                      🔴 Sesión Cerrada
                    </Badge>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">Fondo de Apertura</span>
                  <span className="font-bold text-emerald-700 text-sm block mt-1">
                    {open ? fmtMoney(open.openingBalance, a.currency) : "—"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detalle de Sesión Exclusiva para esta Caja */}
      {!activeSession ? (
        <Card title={`🔐 ESTADO DE CAJA ${currentAccount?.code ?? ""} (${agencyLabel}): APERTURA PENDIENTE`}>
          <div className="p-6 text-center space-y-3">
            <div className="text-4xl">🔒</div>
            <h3 className="text-base font-bold text-slate-800">
              La caja de {agencyLabel} ({currentAccount?.code ?? ""}) aún no ha sido aperturada por el Administrador.
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              De acuerdo con las políticas de seguridad del sistema, el saldo de apertura es asignado únicamente desde la <strong>Consola de Administración</strong>.
            </p>
            <div className="inline-block bg-amber-50 border border-amber-200 text-amber-900 text-xs px-4 py-2 rounded-lg font-semibold">
              ℹ️ Solicite a su Administrador habilitar el turno de la caja de {agencyLabel} en el Panel Admin.
            </div>
          </div>
        </Card>
      ) : (
        <Card
          title={`🌆 CIERRE Y ARQUEO DE CAJA — ${currentAccount?.code ?? ""} (${agencyLabel})`}
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
                <span>💵</span> MONTO DE APERTURA ASIGNADO A ESTA CAJA:
              </div>
              <div className="text-3xl font-black text-emerald-400">
                {fmtMoney(
                  activeSession.openingBalance,
                  currentAccount?.currency ?? "USD"
                )}
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                Apertura registrada el {fmtDate(activeSession.openedAt)} por {activeSession.openedBy?.fullName ?? "Administración"}
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 text-sm space-y-2">
              <div className="flex justify-between border-t border-slate-200 pt-1">
                <span className="text-slate-800 font-bold">
                  Saldo Esperado según Sistema:
                </span>
                <span className="font-extrabold text-blue-700 text-base">
                  {fmtMoney(
                    activeSession.expectedBalance ?? activeSession.openingBalance,
                    currentAccount?.currency ?? "USD"
                  )}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Al finalizar la jornada, cuente el efectivo físico disponible en la caja de {agencyLabel} e ingrese el total para realizar el arqueo final.
            </p>

            <CloseButton
              session={activeSession}
              currency={currentAccount?.currency ?? "USD"}
              onClose={closeSession}
              working={working}
            />
          </div>
        </Card>
      )}

      {/* Historial Exclusivo de la Caja Propia */}
      <Card title={`📜 Historial Exclusivo de Sesiones — Caja ${currentAccount?.code ?? ""} (${agencyLabel})`}>
        {sessions.filter((s) => s.cashAccountId === currentAccount?.id).length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">
            Sin sesiones registradas para la caja de {agencyLabel}.
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
              {sessions
                .filter((s) => s.cashAccountId === currentAccount?.id)
                .map((s) => {
                  const curr = currentAccount?.currency ?? "USD";
                  return (
                    <tr key={s.id} className="border-b border-slate-50">
                      <td className="py-2">
                        <Badge
                          className={
                            s.status === "OPEN"
                              ? "bg-emerald-100 text-emerald-800 font-bold"
                              : "bg-slate-200 text-slate-600"
                          }
                        >
                          {s.status === "OPEN" ? "Abierta" : "Cerrada"}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs">{fmtDate(s.openedAt)}</td>
                      <td className="py-2 font-bold text-emerald-700">
                        {fmtMoney(s.openingBalance, curr)}
                      </td>
                      <td className="py-2 font-semibold">
                        {fmtMoney(s.expectedBalance ?? s.openingBalance, curr)}
                      </td>
                      <td className="py-2">
                        {s.actualBalance != null
                          ? fmtMoney(s.actualBalance, curr)
                          : "—"}
                      </td>
                      <td className="py-2 font-bold">
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
  currency,
  onClose,
  working,
}: {
  session: CashSession;
  currency: string;
  onClose: (id: string, amount: number) => void;
  working: boolean;
}) {
  const [amount, setAmount] = useState("");
  const expected = Number(session.expectedBalance || session.openingBalance || 0);
  const counted = amount !== "" ? Number(amount) : null;
  const diff = counted != null ? counted - expected : null;

  return (
    <div className="space-y-3">
      <Input
        label={`Monto contado al arqueo (Efectivo físico en caja ${currency})`}
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
            : `⚠️ Diferencia detectada: ${diff > 0 ? "+" : ""}${diff.toFixed(2)} ${currency} (${diff > 0 ? "Sobrante" : "Faltante"})`}
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

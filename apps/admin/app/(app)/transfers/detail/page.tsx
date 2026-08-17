"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Spinner } from "@/components/ui";
import { get } from "@/lib/api";
import { STATUS_COLORS, STATUS_LABELS, fmtDate, fmtMoney } from "@/lib/format";
import type { Transfer } from "@/lib/types";

export default function TransferDetailPage() {
  const [id, setId] = useState<string>("");
  const [t, setT] = useState<Transfer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    get<Transfer>(`/transfers/${id}`)
      .then(setT)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Error al cargar"),
      );
  }, [id]);

  useEffect(() => {
    const qid = new URLSearchParams(window.location.search).get("id");
    if (qid) setId(qid);
  }, []);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleRegenerateCode = async () => {
    if (!t) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await post<Transfer>(`/transfers/${t.id}/regenerate-code`, {});
      setT(res);
      setActionSuccess("¡Nuevo código de retiro generado con éxito y notificado a ventanilla!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al regenerar código");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenWhatsapp = async () => {
    if (!t) return;
    try {
      const res = await get<{ link: string }>(`/transfers/${t.id}/whatsapp-link`);
      window.open(res.link, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar enlace de WhatsApp");
    }
  };

  if (error)
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Link href="/transfers">
          <Button variant="secondary">Volver</Button>
        </Link>
      </div>
    );
  if (!t) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {actionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm font-semibold">
          {actionSuccess}
        </div>
      )}

      {t.status === "RISK_BLOCKED" && (
        <Card className="border-red-300 bg-red-50">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-red-800">
              <span>⚠️ ALERTA DE SEGURIDAD ANTI-FRAUDE</span>
            </div>
            <p className="text-xs text-red-700">
              Esta operación fue BLOQUEADA debido a 3 intentos fallidos de verificación de documento en la ventanilla de retiro en Perú.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
                onClick={handleRegenerateCode}
                disabled={actionLoading}
              >
                {actionLoading ? "Regenerando..." : "🔑 Desbloquear y Regenerar Nuevo Código"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold text-slate-900">
            {t.reference}
          </h1>
          <div className="text-sm text-slate-500">
            {fmtDate(t.createdAt)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {t.withdrawalCode && (
            <Button variant="secondary" onClick={handleOpenWhatsapp} className="border-emerald-600 text-emerald-700 hover:bg-emerald-50">
              📲 Notificar por WhatsApp
            </Button>
          )}
          <Badge className={STATUS_COLORS[t.status]}>
            {STATUS_LABELS[t.status] ?? t.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card title="Remitente">
          <div className="text-sm font-semibold text-slate-800">
            {t.sender.fullName}
          </div>
          <div className="text-xs text-slate-500">
            {t.sender.documentType} {t.sender.documentNumber}
          </div>
          <Badge
            className={
              t.sender.kycStatus === "APPROVED"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }
          >
            KYC {t.sender.kycStatus}
          </Badge>
        </Card>
        <Card title="Beneficiario">
          <div className="text-sm font-semibold text-slate-800">
            {t.beneficiary.fullName}
          </div>
          <div className="text-xs text-slate-500">
            {t.beneficiary.documentType} {t.beneficiary.documentNumber}
          </div>
        </Card>
        <Card title="Código de retiro">
          <div className="font-mono text-sm font-bold text-slate-900">
            {t.withdrawalCode ?? "—"}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between mt-1">
            <span>{t.withdrawalUsed ? "Utilizado" : "No utilizado"}</span>
            {t.payoutMethod === "CASH" && (
              <button
                onClick={handleRegenerateCode}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Regenerar
              </button>
            )}
          </div>
        </Card>
      </div>

      <Card title="Montos y Cumplimiento UAFE/SBS">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-slate-500">Envía</div>
            <div className="text-lg font-bold">
              {fmtMoney(t.sendAmount, t.sendCurrency)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Comisión</div>
            <div className="text-lg font-bold">
              {fmtMoney(t.feeAmount, t.sendCurrency)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Recibe (tipo {t.fxRate})</div>
            <div className="text-lg font-bold text-emerald-700">
              {fmtMoney(t.receiveAmount, t.receiveCurrency)}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <div>
            <span className="font-semibold text-slate-800">Motivo del Envío: </span>
            {t.remittanceReason ?? "Ayuda Familiar / Remesa"}
          </div>
          <div>
            <span className="font-semibold text-slate-800">Forma de Entrega: </span>
            {t.payoutMethod === "CASH" ? "Efectivo en Ventanilla (Código)" : "Depósito a Cuenta Bancaria"}
          </div>
        </div>
      </Card>

      <Card title="Eventos">
        <ol className="space-y-3">
          {(t.events ?? []).map((ev) => (
            <li key={ev.id} className="flex items-start gap-3 text-sm">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
              <div className="flex-1">
                <div className="font-medium text-slate-800">
                  {ev.fromStatus
                    ? `${STATUS_LABELS[ev.fromStatus] ?? ev.fromStatus} → ${STATUS_LABELS[ev.toStatus] ?? ev.toStatus}`
                    : STATUS_LABELS[ev.toStatus] ?? ev.toStatus}
                </div>
                <div className="text-xs text-slate-400">
                  {fmtDate(ev.createdAt)}
                  {ev.note ? ` · ${ev.note}` : ""}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

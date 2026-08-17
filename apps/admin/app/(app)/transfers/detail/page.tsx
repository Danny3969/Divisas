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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold text-slate-900">
            {t.reference}
          </h1>
          <div className="text-sm text-slate-500">
            {fmtDate(t.createdAt)}
          </div>
        </div>
        <Badge className={STATUS_COLORS[t.status]}>
          {STATUS_LABELS[t.status] ?? t.status}
        </Badge>
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
          <div className="text-xs text-slate-500">
            {t.withdrawalUsed ? "Utilizado" : "No utilizado"}
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

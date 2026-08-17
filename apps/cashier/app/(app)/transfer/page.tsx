"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Select,
  Spinner,
} from "@/components/ui";
import { get, post } from "@/lib/api";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  fmtDate,
  fmtMoney,
} from "@/lib/format";
import type { CashAccount, Transfer } from "@/lib/types";

export default function TransferDetailPage() {
  const [id, setId] = useState<string>("");
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [cashAccountId, setCashAccountId] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [working, setWorking] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const t = await get<Transfer>(`/transfers/${id}`);
      setTransfer(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let ignore = false;
    if (!id) return;
    async function run() {
      try {
        const t = await get<Transfer>(`/transfers/${id}`);
        if (!ignore) setTransfer(t);
        const accs = await get<CashAccount[]>("/cash/accounts");
        if (ignore) return;
        setCashAccounts(accs);
        if (accs.length > 0) setCashAccountId(accs[0].id);
      } catch (err) {
        if (!ignore)
          setError(err instanceof Error ? err.message : "Error al cargar");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, [id]);

  useEffect(() => {
    const qid = new URLSearchParams(window.location.search).get("id");
    if (qid) setId(qid);
  }, []);

  const [sourceOfFunds, setSourceOfFunds] = useState("Sueldo/Honorarios");
  const [highBillSerials, setHighBillSerials] = useState("");
  const [cashAmountReceived, setCashAmountReceived] = useState("");

  const sendAmountNum = Number(transfer.sendAmount);
  const receivedNum = Number(cashAmountReceived || sendAmountNum);
  const changeDue = Math.max(0, receivedNum - sendAmountNum);

  const cashIn = async () => {
    if (!cashAccountId) return;
    setWorking(true);
    try {
      const t = await post<Transfer>("/payments/cash", {
        transferId: id,
        cashAccountId,
        referenceCode: referenceCode || undefined,
        sourceOfFunds,
        highBillSerials: highBillSerials || undefined,
      });
      setTransfer(t);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al registrar pago");
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <Spinner />;
  if (error || !transfer)
    return (
      <div className="space-y-4">
        <Alert>{error ?? "No encontrada"}</Alert>
        <Link href="/dashboard">
          <Button variant="secondary">Volver</Button>
        </Link>
      </div>
    );

  const canCashIn =
    transfer.status === "CONFIRMED" || transfer.status === "AWAITING_PAYMENT";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {transfer.reference}
          </h1>
          <div className="text-sm text-slate-500">
            Creada el {fmtDate(transfer.createdAt)}
          </div>
        </div>
        <Badge className={STATUS_COLORS[transfer.status]}>
          {STATUS_LABELS[transfer.status] ?? transfer.status}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card title="Envía (Remitente)">
          <div className="text-lg font-bold text-slate-900">
            {fmtMoney(transfer.sendAmount, transfer.sendCurrency)}
          </div>
          <div className="text-xs font-semibold text-slate-700">
            {transfer.sender.fullName}
          </div>
          <div className="text-xs text-slate-500">
            {transfer.sender.documentType} {transfer.sender.documentNumber}
          </div>
        </Card>
        <Card title="Recibe (Beneficiario)">
          <div className="text-lg font-bold text-emerald-700">
            {fmtMoney(transfer.receiveAmount, transfer.receiveCurrency)}
          </div>
          <div className="text-xs font-semibold text-slate-700">
            {transfer.beneficiary.fullName}
          </div>
          <div className="text-xs text-slate-500">
            {transfer.beneficiary.documentType} {transfer.beneficiary.documentNumber}
          </div>
        </Card>
        <Card title="Código de retiro">
          {transfer.withdrawalCode ? (
            <>
              <div className="font-mono text-sm font-bold text-slate-900">
                {transfer.withdrawalCode}
              </div>
              <div className="text-xs text-slate-500">
                {transfer.withdrawalUsed ? "Ya utilizado" : "Disponible"}
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-400">—</div>
          )}
        </Card>
      </div>

      {canCashIn && (
        <Card title="Formulario de Recepción en Efectivo (CASH-IN)">
          <div className="space-y-4">
            {transfer.status !== "CONFIRMED" && (
              <Alert kind="info">
                La operación está en estado {STATUS_LABELS[transfer.status]}.
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Caja Receptora"
                value={cashAccountId}
                onChange={(e) => setCashAccountId(e.target.value)}
              >
                {cashAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} ({a.currency})
                  </option>
                ))}
              </Select>
              <Select
                label="Origen de Fondos (Regulación UAFE/SBS)"
                value={sourceOfFunds}
                onChange={(e) => setSourceOfFunds(e.target.value)}
              >
                <option value="Sueldo/Honorarios">Sueldo / Honorarios</option>
                <option value="Ahorros">Ahorros Personales</option>
                <option value="Actividad Comercial">Actividad Comercial / Ventas</option>
                <option value="Venta de Inmueble/Vehiculo">Venta de Inmueble / Vehículo</option>
                <option value="Prestamo">Préstamo Bancario / Personal</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Efectivo entregado por cliente"
                type="number"
                step="0.01"
                value={cashAmountReceived}
                onChange={(e) => setCashAmountReceived(e.target.value)}
                placeholder={String(sendAmountNum)}
              />
              <div className="flex flex-col justify-end">
                <div className="rounded-lg bg-slate-100 p-2 text-sm">
                  <span className="text-xs text-slate-500 block">Vuelto / Cambio a entregar:</span>
                  <span className="font-bold text-slate-900 text-base">{fmtMoney(changeDue, transfer.sendCurrency)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Series de Billetes de Alta Denominación (Opcional)"
                value={highBillSerials}
                onChange={(e) => setHighBillSerials(e.target.value)}
                placeholder="Ej: B239102, C910238"
              />
              <Input
                label="Referencia / Comprobante Físico"
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                placeholder="BOL-000123"
              />
            </div>

            <Button onClick={cashIn} loading={working} className="w-full">
              Confirmar Recibo de {fmtMoney(transfer.sendAmount, transfer.sendCurrency)}
            </Button>
          </div>
        </Card>
      )}

      {transfer.status === "SETTLEMENT_PENDING" &&
        transfer.payoutMethod === "CASH" && (
          <Alert kind="success">
            Pago recibido y operación lista. El beneficiario puede retirar con
            el código{" "}
            <span className="font-mono font-bold">
              {transfer.withdrawalCode}
            </span>{" "}
            desde{" "}
            <Link href="/payout" className="font-semibold underline">
              Retiro / cash-out
            </Link>
            .
          </Alert>
        )}

      <Card title="Historial de estados">
        {transfer.events && transfer.events.length > 0 ? (
          <ol className="space-y-3">
            {transfer.events.map((ev) => (
              <li key={ev.id} className="flex items-start gap-3 text-sm">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">
                      {ev.fromStatus
                        ? `${STATUS_LABELS[ev.fromStatus] ?? ev.fromStatus} → ${STATUS_LABELS[ev.toStatus] ?? ev.toStatus}`
                        : STATUS_LABELS[ev.toStatus] ?? ev.toStatus}
                    </span>
                    {ev.note && (
                      <span className="text-xs text-slate-400">{ev.note}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {fmtDate(ev.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="text-sm text-slate-400">Sin eventos.</div>
        )}
      </Card>
    </div>
  );
}

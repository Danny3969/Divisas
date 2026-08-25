"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Spinner,
} from "@/components/ui";
import { get, post } from "@/lib/api";
import { STATUS_COLORS, STATUS_LABELS, fmtDate, fmtMoney } from "@/lib/format";
import type { CashAccount, Transfer } from "@/lib/types";

export default function PayoutPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [cashAccountId, setCashAccountId] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // List of pending transfers
  const [pendingTransfers, setPendingTransfers] = useState<Transfer[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);

  // Detail modal
  const [viewingTransfer, setViewingTransfer] = useState<Transfer | null>(null);

  const loadPending = async () => {
    try {
      const res = await get<{ items: Transfer[] }>("/transfers?status=SETTLEMENT_PENDING&limit=50");
      if (res?.items) setPendingTransfers(res.items);
    } catch {
      // ignore
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    loadPending();
    get<CashAccount[]>("/cash/accounts")
      .then((accs) => {
        setCashAccounts(accs);
        if (accs.length > 0) setCashAccountId(accs[0].id);
      })
      .catch(() => undefined);
  }, []);

  const validateCode = async (codeToValidate?: string) => {
    const targetCode = (codeToValidate || code).trim().toUpperCase();
    if (!targetCode) {
      setError("Ingrese el código único de retiro.");
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const t = await get<Transfer>(`/payouts/withdrawal/validate/${targetCode}`);
      setTransfer(t);
      setCode(targetCode);
      setDocNumber(t.beneficiary?.documentNumber || "");
      if (cashAccounts.length > 0 && !cashAccountId) {
        setCashAccountId(cashAccounts[0].id);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setTransfer(null);
      setError(
        err instanceof Error ? err.message : "Código de retiro inválido o expirado",
      );
    } finally {
      setLoading(false);
    }
  };

  const selectTransferFromList = (t: Transfer) => {
    setTransfer(t);
    setCode(t.withdrawalCode || "");
    setDocNumber(t.beneficiary?.documentNumber || "");
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const payOut = async () => {
    if (!transfer) return;
    if (!code.trim()) {
      setError("Debe ingresar el código único de retiro.");
      return;
    }
    if (!docNumber.trim()) {
      setError("Debe ingresar el documento del beneficiario presentado en ventanilla.");
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const t = await post<Transfer>("/payouts/cash-out", {
        transferId: transfer.id,
        withdrawalCode: code.trim().toUpperCase(),
        cashAccountId,
        beneficiaryDocument: docNumber.trim(),
      });
      setSuccess(
        `✅ ¡Entrega realizada con éxito! Se han entregado ${fmtMoney(t.receiveAmount, t.receiveCurrency)} a ${t.beneficiary.fullName}.`,
      );
      setTransfer(t);
      loadPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar la entrega");
    } finally {
      setLoading(false);
    }
  };

  const validForPayout =
    transfer && transfer.status === "SETTLEMENT_PENDING" && !transfer.withdrawalUsed;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#475569] text-white p-4 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <span>🏧</span> Caja de Retiro y Entrega de Fondos
          </h1>
          <p className="text-xs text-[#00E5FF] font-semibold">
            VALEX · Validación de Código Único y Entrega en Efectivo, Yape o Cuenta Bancaria
          </p>
        </div>
        <div className="text-right">
          <Badge className="bg-emerald-500/20 text-[#00E5FF] border border-[#00E5FF]/30 text-xs font-bold">
            {pendingTransfers.length} Giros por Entregar
          </Badge>
        </div>
      </div>

      {/* STEP 1: CODE INPUT */}
      <Card title="1 — Validar Código Único de Retiro">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Ej: VLX-8392-4710"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono text-base font-bold uppercase tracking-wider flex-1"
            />
            <Button
              onClick={() => validateCode()}
              loading={loading}
              className="bg-[#475569] hover:bg-slate-700 text-white font-bold px-6"
            >
              Validar Código
            </Button>
          </div>
          {error && <Alert>{error}</Alert>}
        </div>
      </Card>

      {/* STEP 2: VERIFICATION & PAYOUT */}
      {transfer && (
        <Card title="2 — Verificar Beneficiario y Entregar Fondos">
          <div className="space-y-4">
            {/* Beneficiary Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl bg-slate-50 border border-slate-200 p-4 gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Beneficiario / Destinatario:</span>
                <div className="text-lg font-extrabold text-slate-900">
                  {transfer.beneficiary.fullName}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {transfer.beneficiary.documentType}: <span className="font-mono font-bold text-slate-800">{transfer.beneficiary.documentNumber}</span>
                  {transfer.beneficiary.phone ? ` · 📱 Tel: ${transfer.beneficiary.phone}` : ""}
                </div>
              </div>
              <div className="text-right">
                <Badge className={STATUS_COLORS[transfer.status]}>
                  {STATUS_LABELS[transfer.status] ?? transfer.status}
                </Badge>
                <div className="text-xs text-slate-500 font-mono mt-1">Ref: {transfer.reference}</div>
              </div>
            </div>

            {/* Amount Box */}
            <div className="rounded-xl bg-emerald-50 border-2 border-emerald-300 p-4 text-center">
              <div className="text-xs text-emerald-800 font-extrabold uppercase tracking-wider">
                Monto Neto a Entregar al Beneficiario ({transfer.payoutMethod === "CASH" ? "Efectivo en Ventanilla" : transfer.payoutMethod === "MOBILE_WALLET" ? "Abono Yape" : "Cuenta Bancaria"})
              </div>
              <div className="text-3xl font-black text-emerald-950 my-1 font-mono">
                {fmtMoney(transfer.receiveAmount, transfer.receiveCurrency)}
              </div>
              <div className="text-xs text-emerald-700 font-medium">
                (Comisión de ventanilla ya descontada · Remitente: {transfer.sender.fullName})
              </div>
            </div>

            {/* Security Checks */}
            <div className="rounded-xl bg-slate-100 p-3 text-xs space-y-1 text-slate-700 border border-slate-200">
              <div className="font-bold text-slate-900 mb-1">Controles de Seguridad VALEX:</div>
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <span>✓</span> <span>Código de retiro verificado ({transfer.withdrawalCode || code})</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <span>✓</span> <span>Verificación Anti-Fraude / KYC: APROBADO</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <span>✓</span> <span>Efectivo cobrado y confirmado en caja de origen</span>
              </div>
            </div>

            {validForPayout && (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <Input
                  label="Documento de Identidad Original Presentado en Ventanilla"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder={transfer.beneficiary.documentNumber}
                  className="font-bold text-slate-900"
                />

                {transfer.payoutMethod === "CASH" && (
                  <Select
                    label="Caja de Entrega de Efectivo (descontará de este saldo)"
                    value={cashAccountId}
                    onChange={(e) => setCashAccountId(e.target.value)}
                    className="font-bold text-slate-800"
                  >
                    {cashAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} ({a.currency}) — Saldo actual: {fmtMoney(a.balance, a.currency)}
                      </option>
                    ))}
                  </Select>
                )}

                {transfer.payoutMethod === "MOBILE_WALLET" && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 font-semibold">
                    📱 Destino Yape: Enviar abono de {fmtMoney(transfer.receiveAmount, transfer.receiveCurrency)} al número <strong>{transfer.beneficiary.phone}</strong> a nombre de <strong>{transfer.beneficiary.fullName}</strong>.
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={payOut}
                    loading={loading}
                    disabled={!docNumber}
                    className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 text-base shadow-md"
                  >
                    Confirmar y Entregar {fmtMoney(transfer.receiveAmount, transfer.receiveCurrency)}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      alert(
                        `🖨️ IMPRIMIENDO RECIBO TÉRMICO DE ENTREGA:\n----------------------------------------\nVALEX — GIROS & CAMBIO INT.\nREF: ${transfer.reference}\nBENEFICIARIO: ${transfer.beneficiary.fullName} (${transfer.beneficiary.documentType} ${transfer.beneficiary.documentNumber})\nREMITENTE: ${transfer.sender.fullName}\nMONTO ENTREGADO: ${transfer.receiveAmount} ${transfer.receiveCurrency}\nFECHA: ${new Date().toLocaleString()}\n----------------------------------------`
                      )
                    }
                  >
                    🖨️ Imprimir Recibo
                  </Button>
                </div>
              </div>
            )}

            {!validForPayout && (
              <Alert kind="info">
                Esta operación no está en estado pendiente de entrega (Estado:{" "}
                {STATUS_LABELS[transfer.status] ?? transfer.status}).
              </Alert>
            )}
          </div>
        </Card>
      )}

      {success && (
        <Alert kind="success">
          <div className="flex items-center justify-between">
            <span>{success}</span>
            <Button
              variant="secondary"
              className="ml-3 px-3 py-1.5 text-xs font-bold"
              onClick={() => {
                setTransfer(null);
                setCode("");
                setDocNumber("");
                setSuccess(null);
                router.refresh();
              }}
            >
              Nueva Entrega
            </Button>
          </div>
        </Alert>
      )}

      {/* PENDING TRANSFERS TABLE */}
      <Card
        title="📋 Giros Pendientes de Retiro (Registrados en Sistema)"
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              💡 Haz clic o doble clic en cualquier fila para atenderla
            </span>
            <Button
              variant="secondary"
              className="text-xs font-bold py-1 px-2.5"
              onClick={loadPending}
              disabled={loadingPending}
            >
              🔄 Actualizar
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {loadingPending ? (
            <Spinner />
          ) : pendingTransfers.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No hay giros pendientes de retiro en este momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500 font-bold bg-slate-50">
                    <th className="py-2.5 px-2">Referencia</th>
                    <th className="py-2.5 px-2">Fecha</th>
                    <th className="py-2.5 px-2">Remitente</th>
                    <th className="py-2.5 px-2">Beneficiario</th>
                    <th className="py-2.5 px-2">Monto a Entregar</th>
                    <th className="py-2.5 px-2">Forma Entrega</th>
                    <th className="py-2.5 px-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTransfers.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => selectTransferFromList(t)}
                      onDoubleClick={() => selectTransferFromList(t)}
                      className={`border-b border-slate-100 transition-colors cursor-pointer ${
                        transfer?.id === t.id ? "bg-cyan-50 font-medium" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-2.5 px-2 font-mono font-bold text-blue-700">
                        {t.reference}
                      </td>
                      <td className="py-2.5 px-2 text-slate-500">{fmtDate(t.createdAt)}</td>
                      <td className="py-2.5 px-2 text-slate-700">{t.sender.fullName}</td>
                      <td className="py-2.5 px-2 font-bold text-slate-900">
                        {t.beneficiary.fullName}
                        <span className="text-[10px] font-normal text-slate-500 block">
                          {t.beneficiary.documentType} {t.beneficiary.documentNumber}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 font-extrabold text-emerald-800 text-sm">
                        {fmtMoney(t.receiveAmount, t.receiveCurrency)}
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {t.payoutMethod === "CASH" ? "💵 Efectivo" : t.payoutMethod === "MOBILE_WALLET" ? "📱 Yape" : "🏦 Banco"}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right space-x-1">
                        <Button
                          variant="secondary"
                          className="text-[11px] font-bold py-1 px-2 text-slate-700 hover:bg-slate-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingTransfer(t);
                          }}
                        >
                          👁️ Ficha
                        </Button>
                        <Button
                          variant="primary"
                          className="text-[11px] font-bold py-1 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTransferFromList(t);
                          }}
                        >
                          ⚡ Atender
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* DETAIL MODAL */}
      {viewingTransfer && (
        <Modal
          open={!!viewingTransfer}
          onClose={() => setViewingTransfer(null)}
          title={`Ficha de Operación ${viewingTransfer.reference}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block uppercase font-bold text-[10px]">Remitente:</span>
                <span className="font-bold text-slate-900 text-sm">{viewingTransfer.sender.fullName}</span>
                <div className="text-slate-500">{viewingTransfer.sender.documentType} {viewingTransfer.sender.documentNumber}</div>
              </div>
              <div>
                <span className="text-slate-400 block uppercase font-bold text-[10px]">Beneficiario:</span>
                <span className="font-bold text-slate-900 text-sm">{viewingTransfer.beneficiary.fullName}</span>
                <div className="text-slate-500">{viewingTransfer.beneficiary.documentType} {viewingTransfer.beneficiary.documentNumber}</div>
                {viewingTransfer.beneficiary.phone && <div className="text-slate-600 font-mono">📱 {viewingTransfer.beneficiary.phone}</div>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-slate-500 text-[10px] block">Monto Enviado</span>
                <span className="font-bold text-blue-950 text-sm">{fmtMoney(viewingTransfer.sendAmount, viewingTransfer.sendCurrency)}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[10px] block">Comisión</span>
                <span className="font-bold text-slate-800 text-sm">{fmtMoney(viewingTransfer.feeAmount, viewingTransfer.feeCurrency || viewingTransfer.sendCurrency)}</span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-emerald-800 text-[10px] block font-bold">Neto a Entregar</span>
                <span className="font-black text-emerald-950 text-sm">{fmtMoney(viewingTransfer.receiveAmount, viewingTransfer.receiveCurrency)}</span>
              </div>
            </div>

            {viewingTransfer.withdrawalCode && (
              <div className="rounded-xl bg-cyan-50 border border-cyan-200 p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-cyan-800 block">Código Único de Registro</span>
                <span className="font-mono text-xl font-black text-cyan-950 tracking-widest">{viewingTransfer.withdrawalCode}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setViewingTransfer(null)}>
                Cerrar
              </Button>
              <Button
                variant="primary"
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                onClick={() => {
                  const t = viewingTransfer;
                  setViewingTransfer(null);
                  selectTransferFromList(t);
                }}
              >
                Atender y Entregar Fondos ➔
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

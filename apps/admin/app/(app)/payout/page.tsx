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

function maskValexCode(code?: string) {
  if (!code) return "—";
  const parts = code.split("-");
  if (parts.length === 3) {
    return `${parts[0]}-${parts[1]}-••••`;
  }
  return code.slice(0, Math.ceil(code.length / 2)) + "••••";
}

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

  // Filter tabs
  const [statusTab, setStatusTab] = useState<"PENDING" | "COMPLETED">("PENDING");
  const [directionFilter, setDirectionFilter] = useState<string>("ALL");

  // List of pending transfers
  const [transfersList, setTransfersList] = useState<Transfer[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Detail modal
  const [viewingTransfer, setViewingTransfer] = useState<Transfer | null>(null);

  const loadTransfers = async () => {
    setLoadingList(true);
    try {
      const statusParam = statusTab === "PENDING" ? "SETTLEMENT_PENDING" : "COMPLETED";
      const res = await get<{ items: Transfer[] }>(`/transfers?status=${statusParam}&limit=50`);
      if (res?.items) setTransfersList(res.items);
    } catch {
      // ignore
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, [statusTab]);

  useEffect(() => {
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
      setError("Ingrese el Código Único de VALEX.");
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
        err instanceof Error ? err.message : "Código Único de VALEX inválido o expirado",
      );
    } finally {
      setLoading(false);
    }
  };

  const selectTransferFromList = (t: Transfer) => {
    setTransfer(t);
    // DO NOT auto-fill the code: the cashier MUST enter the code presented by the beneficiary
    setCode("");
    setDocNumber(t.beneficiary?.documentNumber || "");
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Check if entered code matches the selected transfer
  const isCodeMatch =
    transfer &&
    code.trim().toUpperCase() &&
    transfer.withdrawalCode &&
    code.trim().toUpperCase() === transfer.withdrawalCode.trim().toUpperCase();

  const isCodeEntered = Boolean(code.trim());

  const payOut = async () => {
    if (!transfer) return;
    if (!code.trim()) {
      setError("Debe ingresar el Código Único de VALEX.");
      return;
    }
    if (!isCodeMatch) {
      setError("El Código Único de VALEX ingresado NO coincide con esta transacción. No se puede realizar el pago.");
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
        `✅ ¡Transacción CANCELADA / PAGADA con éxito! Se han entregado ${fmtMoney(t.receiveAmount, t.receiveCurrency)} a ${t.beneficiary.fullName}.`,
      );
      setTransfer(t);
      loadTransfers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar la entrega");
    } finally {
      setLoading(false);
    }
  };

  const validForPayout =
    transfer && transfer.status === "SETTLEMENT_PENDING" && !transfer.withdrawalUsed;

  const filteredItems = transfersList.filter((t) => {
    if (directionFilter === "EC_TO_PE") return t.corridor?.direction === "EC_TO_PE";
    if (directionFilter === "PE_TO_EC") return t.corridor?.direction === "PE_TO_EC";
    return true;
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#475569] text-white p-4 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <span>📥</span> VALEX Recibidos — Caja de Retiro & Entrega
          </h1>
          <p className="text-xs text-[#00E5FF] font-semibold">
            Giros entrantes para entrega en destino (Perú 🇵🇪 o Ecuador 🇪🇨) con validación de Código Único de VALEX
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="text-xs font-bold text-slate-900 bg-cyan-300 hover:bg-cyan-200"
            onClick={() => router.push("/transfers")}
          >
            📤 Ver VALEX Realizados ➔
          </Button>
          <Badge className="bg-emerald-500/20 text-[#00E5FF] border border-[#00E5FF]/30 text-xs font-bold px-3 py-1">
            {transfersList.filter((t) => t.status === "SETTLEMENT_PENDING").length} Por Entregar
          </Badge>
        </div>
      </div>

      {/* STEP 1: CODE SEARCH */}
      <Card title="1 — Validar Código Único de VALEX">
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
              Validar Código Único de VALEX
            </Button>
          </div>
          {error && <Alert>{error}</Alert>}
        </div>
      </Card>

      {/* STEP 2: VERIFICATION & PAYOUT */}
      {transfer && (
        <Card title="2 — Verificar Beneficiario, Validar Código y Cancelar Transacción">
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
                (Comisión ya descontada · Remitente: {transfer.sender.fullName})
              </div>
            </div>

            {/* Strict Code Validation Box */}
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                🔑 Ingresar Código Único de VALEX (Presentado / Dictado por el Beneficiario) *
              </label>
              <Input
                placeholder="VLX-XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono text-lg font-black uppercase tracking-widest text-slate-900 bg-white"
              />

              {isCodeEntered && isCodeMatch && (
                <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-bold flex items-center gap-2">
                  <span>✅</span>
                  <span>¡Código Único de VALEX Correcto! Coincide exactamente con la transacción. Pago habilitado.</span>
                </div>
              )}

              {isCodeEntered && !isCodeMatch && (
                <div className="p-2.5 bg-red-100 border border-red-300 text-red-900 rounded-lg text-xs font-bold flex items-center gap-2">
                  <span>❌</span>
                  <span>Código de VALEX Incorrecto. No coincide con esta transacción. El pago está bloqueado.</span>
                </div>
              )}

              {!isCodeEntered && (
                <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-medium">
                  ⚠️ Ingrese el Código Único de VALEX para validar la identidad y desbloquear el botón de pago.
                </div>
              )}
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
                    disabled={!isCodeMatch || !docNumber}
                    className="flex-1 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold py-3 text-base shadow-md transition-all"
                  >
                    {isCodeMatch
                      ? `Confirmar Pago de ${fmtMoney(transfer.receiveAmount, transfer.receiveCurrency)} (Marcar Cancelado)`
                      : "Ingrese Código Válido para Pagar"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      alert(
                        `🖨️ IMPRIMIENDO RECIBO TÉRMICO DE ENTREGA:\n----------------------------------------\nVALEX — GIROS & CAMBIO INT.\nREF: ${transfer.reference}\nBENEFICIARIO: ${transfer.beneficiary.fullName} (${transfer.beneficiary.documentType} ${transfer.beneficiary.documentNumber})\nREMITENTE: ${transfer.sender.fullName}\nMONTO ENTREGADO: ${transfer.receiveAmount} ${transfer.receiveCurrency}\nESTADO: CANCELADO / PAGADO\nFECHA: ${new Date().toLocaleString()}\n----------------------------------------`
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

      {/* TABS FOR STATUS & DIRECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
        {/* Status Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setStatusTab("PENDING")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              statusTab === "PENDING"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            ⏳ Pendientes de Entrega
          </button>
          <button
            onClick={() => setStatusTab("COMPLETED")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              statusTab === "COMPLETED"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            ✅ Cancelados / Entregados (Historial)
          </button>
        </div>

        {/* Direction Filter */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setDirectionFilter("ALL")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
              directionFilter === "ALL" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setDirectionFilter("EC_TO_PE")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
              directionFilter === "EC_TO_PE" ? "bg-blue-700 text-white" : "bg-blue-50 text-blue-800"
            }`}
          >
            🇵🇪 Caja Perú (Entrantes)
          </button>
          <button
            onClick={() => setDirectionFilter("PE_TO_EC")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
              directionFilter === "PE_TO_EC" ? "bg-amber-700 text-white" : "bg-amber-50 text-amber-800"
            }`}
          >
            🇪🇨 Caja Ecuador (Entrantes)
          </button>
        </div>
      </div>

      {/* TRANSFERS LIST TABLE (MASKED CODE) */}
      <Card
        title={statusTab === "PENDING" ? "📋 VALEX Recibidos por Entregar" : "📋 Historial de VALEX Entregados y Cancelados"}
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              💡 Haz clic o doble clic en cualquier fila para atender la transacción
            </span>
            <Button
              variant="secondary"
              className="text-xs font-bold py-1 px-2.5"
              onClick={loadTransfers}
              disabled={loadingList}
            >
              🔄 Actualizar
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {loadingList ? (
            <Spinner />
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No hay giros en esta lista en este momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500 font-bold bg-slate-50">
                    <th className="py-2.5 px-2">Referencia</th>
                    <th className="py-2.5 px-2">Fecha</th>
                    <th className="py-2.5 px-2">Caja Destino</th>
                    <th className="py-2.5 px-2">Remitente</th>
                    <th className="py-2.5 px-2">Beneficiario</th>
                    <th className="py-2.5 px-2">Monto a Entregar</th>
                    <th className="py-2.5 px-2">Código VALEX</th>
                    <th className="py-2.5 px-2">Forma Entrega</th>
                    <th className="py-2.5 px-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((t) => (
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
                      <td className="py-2.5 px-2 text-xs font-bold text-slate-700">
                        {t.corridor?.toCountry.code === "PE" ? "🇵🇪 Perú" : "🇪🇨 Ecuador"}
                      </td>
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
                      <td className="py-2.5 px-2 font-mono text-slate-600 font-semibold">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200" title="La mitad del código está protegida por seguridad">
                          {maskValexCode(t.withdrawalCode)}
                        </span>
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
                        {t.status === "SETTLEMENT_PENDING" && (
                          <Button
                            variant="primary"
                            className="text-[11px] font-bold py-1 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectTransferFromList(t);
                            }}
                          >
                            ⚡ Pagar
                          </Button>
                        )}
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
                <span className="text-[10px] font-bold uppercase text-cyan-800 block">Código Único de VALEX (Protegido)</span>
                <span className="font-mono text-xl font-black text-cyan-950 tracking-widest">{maskValexCode(viewingTransfer.withdrawalCode)}</span>
                <span className="text-[11px] text-slate-500 block mt-1">El cliente debe presentar el código completo en ventanilla para cobrar.</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setViewingTransfer(null)}>
                Cerrar
              </Button>
              {viewingTransfer.status === "SETTLEMENT_PENDING" && (
                <Button
                  variant="primary"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                  onClick={() => {
                    const t = viewingTransfer;
                    setViewingTransfer(null);
                    selectTransferFromList(t);
                  }}
                >
                  Atender y Validar Código ➔
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

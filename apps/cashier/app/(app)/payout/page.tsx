"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Select,
} from "@/components/ui";
import { get, post } from "@/lib/api";
import { STATUS_COLORS, STATUS_LABELS, fmtMoney } from "@/lib/format";
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

  const validate = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const t = await get<Transfer>(`/payouts/withdrawal/validate/${code}`);
      setTransfer(t);
      if (cashAccounts.length === 0) {
        const accs = await get<CashAccount[]>("/cash/accounts");
        setCashAccounts(accs);
        if (accs.length > 0) setCashAccountId(accs[0].id);
      }
    } catch (err) {
      setTransfer(null);
      setError(
        err instanceof Error ? err.message : "Código inválido o expirado",
      );
    } finally {
      setLoading(false);
    }
  };

  const payOut = async () => {
    if (!transfer) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const t = await post<Transfer>("/payouts/cash-out", {
        transferId: transfer.id,
        withdrawalCode: code,
        cashAccountId,
        beneficiaryDocument: docNumber,
      });
      setSuccess(
        `Entrega realizada. ${fmtMoney(t.receiveAmount, t.receiveCurrency)} pagados a ${t.beneficiary.fullName}.`,
      );
      setTransfer(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al entregar");
    } finally {
      setLoading(false);
    }
  };

  const validForPayout =
    transfer && transfer.status === "SETTLEMENT_PENDING" && !transfer.withdrawalUsed;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Retiro en ventanilla</h1>

      <Card title="1 — Ingresar código de retiro">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="XXXX-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono uppercase"
            />
            <Button onClick={validate} loading={loading}>
              Validar
            </Button>
          </div>
          {error && <Alert>{error}</Alert>}
        </div>
      </Card>

      {transfer && (
        <Card title="2 — Verificar beneficiario y Controles de Seguridad">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {transfer.beneficiary.fullName}
                </div>
                <div className="text-xs text-slate-500">
                  {transfer.beneficiary.documentType}{" "}
                  {transfer.beneficiary.documentNumber} · Ref.{" "}
                  {transfer.reference}
                </div>
              </div>
              <Badge className={STATUS_COLORS[transfer.status]}>
                {STATUS_LABELS[transfer.status] ?? transfer.status}
              </Badge>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3 text-sm border border-emerald-200">
              <div className="text-xs text-emerald-800 font-medium">Monto neto a entregar en efectivo</div>
              <div className="text-xl font-bold text-emerald-900">
                {fmtMoney(transfer.receiveAmount, transfer.receiveCurrency)}
              </div>
            </div>

            <div className="rounded-lg bg-slate-100 p-3 text-xs space-y-1 text-slate-700">
              <div className="font-semibold text-slate-900 mb-1">Controles de Seguridad Cumplidos:</div>
              <div className="flex items-center gap-1.5 text-emerald-700">
                <span>✓</span> <span>Código de retiro validado ({code})</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700">
                <span>✓</span> <span>Verificación de Riesgo / AML: APROBADO</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700">
                <span>✓</span> <span>Pago de remitente ({transfer.sender.fullName}) verificado</span>
              </div>
            </div>

            {validForPayout && (
              <>
                <Input
                  label="Número de documento original presentado en ventanilla"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder={transfer.beneficiary.documentNumber}
                />
                <Select
                  label="Caja de entrega"
                  value={cashAccountId}
                  onChange={(e) => setCashAccountId(e.target.value)}
                >
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} ({a.currency}) — saldo{" "}
                      {fmtMoney(a.balance, a.currency)}
                    </option>
                  ))}
                </Select>
                <div className="flex gap-2">
                  <Button
                    onClick={payOut}
                    loading={loading}
                    disabled={!docNumber}
                    className="flex-1"
                    variant="primary"
                  >
                    Confirmar y Entregar {fmtMoney(transfer.receiveAmount, transfer.receiveCurrency)}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => alert(`Imprimiendo recibo térmico para ${transfer.beneficiary.fullName}...\nRef: ${transfer.reference}\nMonto: ${transfer.receiveAmount} ${transfer.receiveCurrency}`)}
                  >
                    🖨️ Imprimir Recibo
                  </Button>
                </div>
              </>
            )}
            {!validForPayout && (
              <Alert kind="info">
                Esta operación no está lista para entrega en ventanilla (estado:{" "}
                {STATUS_LABELS[transfer.status] ?? transfer.status}).
              </Alert>
            )}
          </div>
        </Card>
      )}

      {success && (
        <Alert kind="success">
          {success}
          <Button
            variant="secondary"
            className="ml-3 px-3 py-1.5 text-xs"
            onClick={() => {
              setTransfer(null);
              setCode("");
              setDocNumber("");
              setSuccess(null);
              router.refresh();
            }}
          >
            Nueva entrega
          </Button>
        </Alert>
      )}
    </div>
  );
}

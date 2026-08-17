"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { fmtMoney } from "@/lib/format";
import type {
  Beneficiary,
  CashAccount,
  Corridor,
  Country,
  Customer,
  PaymentMethod,
  PayoutMethod,
  Quote,
  Transfer,
} from "@/lib/types";

type Step = "customer" | "details" | "confirm";

const PAYOUT_LABELS: Record<PayoutMethod, string> = {
  CASH: "Efectivo (cash pickup)",
  BANK: "Cuenta bancaria",
  MOBILE_WALLET: "Billetera móvil",
};
const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  BANK_TRANSFER: "Transferencia bancaria",
};

function CreateCustomerForm({
  countries,
  initialDocType = "CEDULA",
  initialDocNumber = "",
  onCreated,
  onCancel,
}: {
  countries: Country[];
  initialDocType?: string;
  initialDocNumber?: string;
  onCreated: (c: Customer) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    type: "PERSON",
    fullName: "",
    documentType: initialDocType,
    documentNumber: initialDocNumber,
    countryId: countries.find((c) => c.code === "EC")?.id ?? "",
    email: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.fullName || !form.documentNumber || !form.countryId) {
      setError("Complete nombre, documento y país.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const payload = {
        ...form,
        email: form.email || undefined,
        phone: form.phone || undefined,
      };
      const c = await post<Customer>("/customers", payload);
      onCreated(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-blue-300 bg-blue-50 p-4">
      <div className="text-sm font-semibold text-blue-800">
        Cliente no encontrado — registrarlo
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Tipo"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option value="PERSON">Persona</option>
          <option value="BUSINESS">Empresa</option>
        </Select>
        <Input
          label="Nombre completo"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        />
        <Select
          label="Tipo de documento"
          value={form.documentType}
          onChange={(e) => setForm({ ...form, documentType: e.target.value })}
        >
          <option value="CEDULA">Cédula</option>
          <option value="RUC">RUC</option>
          <option value="DNI">DNI</option>
          <option value="PASSPORT">Pasaporte</option>
        </Select>
        <Input
          label="Número de documento"
          value={form.documentNumber}
          onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
        />
        <Select
          label="País"
          value={form.countryId}
          onChange={(e) => setForm({ ...form, countryId: e.target.value })}
        >
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input
          label="Teléfono"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Input
          label="Correo (opcional)"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="col-span-2"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={submit} loading={loading}>
          Registrar cliente
        </Button>
      </div>
    </div>
  );
}

function CreateBeneficiaryForm({
  customerId,
  countries,
  destinationCode,
  onCreated,
  onCancel,
}: {
  customerId: string;
  countries: Country[];
  destinationCode: string;
  onCreated: (b: Beneficiary) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    fullName: "",
    documentType: "DNI",
    documentNumber: "",
    countryId: countries.find((c) => c.code === destinationCode)?.id ?? "",
    phone: "",
    bankName: "",
    accountNumber: "",
    currency: "PEN",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.fullName || !form.documentNumber || !form.countryId) {
      setError("Complete nombre, documento y país del beneficiario.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const b = await post<Beneficiary>("/beneficiaries", {
        customerId,
        fullName: form.fullName,
        documentType: form.documentType,
        documentNumber: form.documentNumber,
        countryId: form.countryId,
        phone: form.phone || undefined,
      });
      if (form.accountNumber && form.bankName) {
        await post(`/beneficiaries/${b.id}/accounts`, {
          bankName: form.bankName,
          accountNumber: form.accountNumber,
          currency: form.currency || undefined,
        });
      }
      onCreated({ ...b, accounts: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear beneficiario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-emerald-300 bg-emerald-50 p-4">
      <div className="text-sm font-semibold text-emerald-800">
        Sin beneficiarios — registrar uno
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Nombre completo"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        />
        <Select
          label="Tipo de documento"
          value={form.documentType}
          onChange={(e) => setForm({ ...form, documentType: e.target.value })}
        >
          <option value="DNI">DNI</option>
          <option value="CEDULA">Cédula</option>
          <option value="PASSPORT">Pasaporte</option>
        </Select>
        <Input
          label="Número de documento"
          value={form.documentNumber}
          onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
        />
        <Select
          label="País"
          value={form.countryId}
          onChange={(e) => setForm({ ...form, countryId: e.target.value })}
        >
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input
          label="Teléfono (opcional)"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Input
          label="Banco (opcional, para pago bancario)"
          value={form.bankName}
          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
          placeholder="BCP, Banco Pichincha..."
        />
        <Input
          label="Número de cuenta (opcional)"
          value={form.accountNumber}
          onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
        />
        <Select
          label="Moneda de la cuenta"
          value={form.currency}
          onChange={(e) => setForm({ ...form, currency: e.target.value })}
        >
          <option value="PEN">PEN</option>
          <option value="USD">USD</option>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={submit} loading={loading}>
          Registrar beneficiario
        </Button>
      </div>
    </div>
  );
}

export default function NewTransferPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("customer");

  const [docType, setDocType] = useState("CEDULA");
  const [docNumber, setDocNumber] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [corridorId, setCorridorId] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [showCreateBeneficiary, setShowCreateBeneficiary] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("CASH");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [remittanceReason, setRemittanceReason] = useState("Ayuda Familiar / Remesa");
  const [sourceOfFunds, setSourceOfFunds] = useState("Sueldo/Honorarios");
  const [highBillSerials, setHighBillSerials] = useState("");
  const [cashAmountReceived, setCashAmountReceived] = useState("");
  const [sendAmount, setSendAmount] = useState("100");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [createdTransfer, setCreatedTransfer] = useState<Transfer | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    get<Country[]>("/fx/countries")
      .then((cs) => {
        if (!ignore) setCountries(cs);
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  const searchCustomer = async () => {
    setCustomerError(null);
    setShowCreateCustomer(false);
    setLoading(true);
    try {
      const c = await get<Customer>(`/customers/document/${docType}/${docNumber}`);
      if (!c) {
        setShowCreateCustomer(true);
      } else {
        await openCustomer(c);
      }
    } catch {
      setShowCreateCustomer(true);
    } finally {
      setLoading(false);
    }
  };

  const openCustomer = async (c: Customer) => {
    if (!c) return;
    setCustomer(c);
    setStep("details");
    const [cors, bens] = await Promise.all([
      get<Corridor[]>("/fx/corridors"),
      get<Beneficiary[]>(`/beneficiaries/customer/${c.id}`),
    ]);
    const active = cors.filter((x) => x.active);
    setCorridors(active);
    setBeneficiaries(bens);
    if (active.length > 0) setCorridorId(active[0].id);
    if (bens.length > 0) {
      setBeneficiaryId(bens[0].id);
      setShowCreateBeneficiary(false);
    } else {
      setBeneficiaryId("");
      setShowCreateBeneficiary(true);
    }
  };

  const loadQuote = async (amount: number) => {
    if (!corridorId || !customer) return;
    setLoading(true);
    try {
      const q = await post<Quote>("/quotes", {
        corridorId,
        sendAmount: amount,
        sendCurrency: corridors.find((c) => c.id === corridorId)?.fromCurrency,
        senderCustomerId: customer.id,
      });
      setQuote(q);
      setStep("confirm");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al cotizar");
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!quote || !customer || !beneficiaryId) return;
    setLoading(true);
    try {
      const t = await post<Transfer>("/transfers", {
        quoteId: quote.id,
        senderCustomerId: customer.id,
        beneficiaryId,
        payoutMethod,
        paymentMethod,
        remittanceReason,
        payoutAccountId:
          payoutMethod === "BANK"
            ? beneficiaries.find((b) => b.id === beneficiaryId)?.accounts?.[0]
                ?.id
            : undefined,
      });

      // Si el pago es en efectivo, se auto-confirma en la caja actual
      if (paymentMethod === "CASH") {
        const accounts = await get<CashAccount[]>("/cash/accounts");
        if (accounts.length > 0) {
          await post<Transfer>("/payments/cash", {
            transferId: t.id,
            cashAccountId: accounts[0].id,
            sourceOfFunds,
            highBillSerials: highBillSerials || undefined,
          });
        }
      }

      const freshTransfer = await get<Transfer>(`/transfers/${t.id}`);
      setCreatedTransfer(freshTransfer);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al crear transferencia");
    } finally {
      setLoading(false);
    }
  };

  const corridor = corridors.find((c) => c.id === corridorId);
  const sendAmountNum = Number(sendAmount || "0");
  const cashReceivedNum = Number(cashAmountReceived || sendAmountNum);
  const changeDue = Math.max(0, cashReceivedNum - sendAmountNum);

  if (createdTransfer) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Card title="✅ Transferencia Generada con Éxito">
          <div className="space-y-4 text-center">
            <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200">
              <div className="text-xs text-emerald-800 uppercase tracking-wide font-semibold">Código Único de Retiro</div>
              <div className="font-mono text-3xl font-extrabold text-emerald-950 my-1">
                {createdTransfer.withdrawalCode ?? "RX7K-PENDIENTE"}
              </div>
              <div className="text-xs text-emerald-700">
                Entrega este código al cliente para que el beneficiario lo retire en Perú.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left text-sm bg-slate-50 p-3 rounded-lg">
              <div>
                <span className="text-xs text-slate-500 block">Referencia:</span>
                <span className="font-mono font-bold text-slate-800">{createdTransfer.reference}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Remitente:</span>
                <span className="font-semibold text-slate-800">{createdTransfer.sender.fullName}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Monto Enviado:</span>
                <span className="font-bold text-slate-900">{fmtMoney(createdTransfer.sendAmount, createdTransfer.sendCurrency)}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Beneficiario:</span>
                <span className="font-semibold text-slate-800">{createdTransfer.beneficiary.fullName}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Monto a Entregar:</span>
                <span className="font-bold text-emerald-800">{fmtMoney(createdTransfer.receiveAmount, createdTransfer.receiveCurrency)}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Motivo:</span>
                <span className="text-xs text-slate-700">{createdTransfer.remittanceReason ?? "Ayuda Familiar"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1 border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-bold"
                  onClick={async () => {
                    try {
                      const res = await get<{ link: string }>(`/transfers/${createdTransfer.id}/whatsapp-link`);
                      window.open(res.link, "_blank");
                    } catch {
                      alert(`WhatsApp: Hola ${createdTransfer.beneficiary.fullName}, ${createdTransfer.sender.fullName} te envió un giro con código ${createdTransfer.withdrawalCode}`);
                    }
                  }}
                >
                  📲 Enviar Notificación por WhatsApp
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() =>
                    alert(
                      `🖨️ IMPRIMIENDO TICKET DE REMESA DE VENTANILLA:\n----------------------------------------\nDIVISAS REMESAS INT.\nCÓDIGO RETIRO: ${createdTransfer.withdrawalCode}\nREF: ${createdTransfer.reference}\nREMITENTE: ${createdTransfer.sender.fullName}\nBENEFICIARIO: ${createdTransfer.beneficiary.fullName}\nMONTO NETO A RETIRAR: ${createdTransfer.receiveAmount} ${createdTransfer.receiveCurrency}\n----------------------------------------`
                    )
                  }
                >
                  🖨️ Imprimir Ticket Ventanilla
                </Button>
              </div>
              <Button
                variant="primary"
                className="w-full mt-1"
                onClick={() => {
                  setCreatedTransfer(null);
                  setStep("customer");
                  setDocNumber("");
                  setCustomer(null);
                }}
              >
                Registrar Nueva Operación
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Nueva transferencia</h1>

      {step === "customer" && (
        <Card title="Paso 1 — Identificar remitente">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Tipo de documento"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                <option value="CEDULA">Cédula</option>
                <option value="RUC">RUC</option>
                <option value="DNI">DNI</option>
                <option value="PASSPORT">Pasaporte</option>
              </Select>
              <Input
                label="Número de documento"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="1700000001"
              />
            </div>
            {customerError && <Alert>{customerError}</Alert>}
            <Button onClick={searchCustomer} loading={loading} className="w-full">
              Buscar cliente
            </Button>
            {showCreateCustomer && countries.length > 0 && (
              <CreateCustomerForm
                countries={countries}
                initialDocType={docType}
                initialDocNumber={docNumber}
                onCreated={(c) => openCustomer(c)}
                onCancel={() => setShowCreateCustomer(false)}
              />
            )}
          </div>
        </Card>
      )}

      {step === "details" && customer && (
        <Card title="Paso 2 — Datos de la operación y regulación UAFE/SBS">
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-800">
                {customer.fullName}
              </div>
              <div className="text-xs text-slate-500">
                {customer.documentType} {customer.documentNumber} · KYC:{" "}
                <Badge
                  className={
                    customer.kycStatus === "APPROVED"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }
                >
                  {customer.kycStatus}
                </Badge>
              </div>
            </div>

            <Select
              label="Corredor de Giro"
              value={corridorId}
              onChange={(e) => setCorridorId(e.target.value)}
            >
              {corridors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fromCountry.name} ({c.fromCurrency}) → {c.toCountry.name} (
                  {c.toCurrency})
                </option>
              ))}
            </Select>

            {showCreateBeneficiary ? (
              <CreateBeneficiaryForm
                customerId={customer.id}
                countries={countries}
                destinationCode={corridor?.toCountry.code ?? "PE"}
                onCreated={(b) => {
                  setBeneficiaries((prev) => [...prev, b]);
                  setBeneficiaryId(b.id);
                  setShowCreateBeneficiary(false);
                }}
                onCancel={() => setShowCreateBeneficiary(false)}
              />
            ) : (
              <Select
                label="Beneficiario (Persona que retira en Perú)"
                value={beneficiaryId}
                onChange={(e) => setBeneficiaryId(e.target.value)}
              >
                <option value="">Seleccionar…</option>
                {beneficiaries.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.fullName} — {b.documentType} {b.documentNumber}
                  </option>
                ))}
              </Select>
            )}
            {!showCreateBeneficiary && (
              <button
                onClick={() => setShowCreateBeneficiary(true)}
                className="text-xs font-medium text-blue-700 hover:underline"
              >
                + Registrar nuevo beneficiario
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Forma de entrega al beneficiario"
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value as PayoutMethod)}
              >
                <option value="CASH">{PAYOUT_LABELS.CASH}</option>
                <option value="BANK">{PAYOUT_LABELS.BANK}</option>
              </Select>
              <Select
                label="Forma de pago del remitente"
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod)
                }
              >
                <option value="CASH">{PAYMENT_LABELS.CASH}</option>
                <option value="BANK_TRANSFER">
                  {PAYMENT_LABELS.BANK_TRANSFER}
                </option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Motivo del envío (UAFE/SBS)"
                value={remittanceReason}
                onChange={(e) => setRemittanceReason(e.target.value)}
              >
                <option value="Ayuda Familiar / Remesa">Ayuda Familiar / Remesa</option>
                <option value="Gastos Médicos / Salud">Gastos Médicos / Salud</option>
                <option value="Pago Proveedor Comercial">Pago Proveedor Comercial</option>
                <option value="Educación / Estudios">Educación / Estudios</option>
                <option value="Compra de Bienes / Servicios">Compra de Bienes / Servicios</option>
              </Select>
              <Select
                label="Origen de fondos"
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

            {paymentMethod === "CASH" && (
              <div className="grid grid-cols-2 gap-3 border-t border-dashed pt-3">
                <Input
                  label="Efectivo recibido del cliente"
                  type="number"
                  step="0.01"
                  value={cashAmountReceived}
                  onChange={(e) => setCashAmountReceived(e.target.value)}
                  placeholder={sendAmount}
                />
                <div className="flex flex-col justify-end">
                  <div className="rounded-lg bg-slate-100 p-2 text-sm">
                    <span className="text-xs text-slate-500 block">Vuelto / Cambio a entregar:</span>
                    <span className="font-bold text-slate-900 text-base">{fmtMoney(changeDue, corridor?.fromCurrency ?? "USD")}</span>
                  </div>
                </div>
              </div>
            )}

            <Input
              label="Series de billetes de alta denominación ($50/$100) — Opcional"
              value={highBillSerials}
              onChange={(e) => setHighBillSerials(e.target.value)}
              placeholder="Ej: B293810, C928102"
            />

            <Input
              label={`Monto a enviar (${corridor?.fromCurrency ?? "USD"})`}
              type="number"
              min="1"
              step="0.01"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
            />

            <Button onClick={() => loadQuote(Number(sendAmount))} loading={loading} className="w-full">
              Cotizar y Continuar al Resumen
            </Button>
          </div>
        </Card>
      )}

      {step === "confirm" && quote && corridor && (
        <Card title="Paso 3 — Confirmación de Operación y Emisión de Código">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Monto depositado por cliente</div>
                <div className="text-lg font-bold text-slate-900">
                  {fmtMoney(quote.sendAmount, quote.sendCurrency)}
                </div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200">
                <div className="text-xs text-emerald-800 font-medium">Monto neto a entregar en Perú</div>
                <div className="text-lg font-bold text-emerald-900">
                  {fmtMoney(quote.receiveAmount, quote.receiveCurrency)}
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Comisión de giro: {fmtMoney(quote.feeAmount, quote.sendCurrency)} · Tipo de cambio: {quote.fxRate}
            </div>
            <Alert kind="info">
              Pago recibido en {paymentMethod === "CASH" ? "efectivo en ventanilla" : "transferencia"}{" "}
              · Retiro en Perú {payoutMethod === "CASH" ? "en efectivo mediante código" : "a cuenta bancaria"} por{" "}
              {beneficiaries.find((b) => b.id === beneficiaryId)?.fullName}.
            </Alert>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setStep("details")}
                disabled={loading}
              >
                Atrás
              </Button>
              <Button onClick={confirm} loading={loading} className="flex-1">
                Confirmar y Emitir Código de Retiro
              </Button>
            </div>
          </div>
        </Card>
      )}

      {loading && step === "details" && <Spinner />}
    </div>
  );
}

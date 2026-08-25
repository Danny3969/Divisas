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
import { fmtMoney, fmtPhone, normalizePhone } from "@/lib/format";
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
  const [phonePrefix, setPhonePrefix] = useState("+593");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCountryChange = (cId: string) => {
    const selected = countries.find((c) => c.id === cId);
    setForm({ ...form, countryId: cId });
    if (selected?.code === "PE") setPhonePrefix("+51");
    else if (selected?.code === "EC") setPhonePrefix("+593");
  };

  const submit = async () => {
    if (!form.fullName || !form.documentNumber || !form.countryId) {
      setError("Complete nombre, documento y país.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const selectedCountry = countries.find((c) => c.id === form.countryId);
      const countryCode = selectedCountry?.code || "EC";
      const formattedPhone = normalizePhone(form.phone, countryCode, phonePrefix);

      const payload = {
        ...form,
        email: form.email || undefined,
        phone: formattedPhone || undefined,
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
          onChange={(e) => handleCountryChange(e.target.value)}
        >
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">Teléfono (Prefijo País)</label>
          <div className="flex gap-2">
            <Select
              value={phonePrefix}
              onChange={(e) => setPhonePrefix(e.target.value)}
              className="w-32 text-xs font-bold"
            >
              <option value="+593">🇪🇨 +593 (EC)</option>
              <option value="+51">🇵🇪 +51 (PE)</option>
            </Select>
            <Input
              placeholder="Ej. 987654321"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>

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
  payoutMethod,
  onCreated,
  onCancel,
}: {
  customerId: string;
  countries: Country[];
  destinationCode: string;
  payoutMethod: PayoutMethod;
  onCreated: (b: Beneficiary) => void;
  onCancel: () => void;
}) {
  const defaultCountry = countries.find((c) => c.code === destinationCode);
  const [form, setForm] = useState({
    fullName: "",
    documentType: "DNI",
    documentNumber: "",
    countryId: defaultCountry?.id ?? "",
    phone: "",
    bankName: payoutMethod === "MOBILE_WALLET" ? "YAPE" : "BCP",
    accountNumber: "",
    accountType: "AHORROS",
    currency: "PEN",
  });
  const [phonePrefix, setPhonePrefix] = useState(
    payoutMethod === "MOBILE_WALLET" || destinationCode === "PE" ? "+51" : "+593"
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.fullName) {
      setError("Ingrese el nombre completo del beneficiario.");
      return;
    }
    if (payoutMethod === "MOBILE_WALLET" && !form.phone) {
      setError("Para retiro por Yape es obligatorio ingresar el número de teléfono.");
      return;
    }
    if (payoutMethod === "BANK" && (!form.bankName || !form.accountNumber)) {
      setError("Para retiro por cuenta bancaria debe ingresar el Banco y el Número de cuenta / CCI.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const destCountry = countries.find((c) => c.id === form.countryId);
      const countryCode = payoutMethod === "MOBILE_WALLET" ? "PE" : (destCountry?.code || destinationCode || "PE");
      const formattedPhone = normalizePhone(form.phone, countryCode, phonePrefix);

      const b = await post<Beneficiary>("/beneficiaries", {
        customerId,
        fullName: form.fullName,
        documentType: form.documentType,
        documentNumber: form.documentNumber || "00000000",
        countryId: form.countryId,
        phone: formattedPhone || undefined,
      });

      if (payoutMethod === "BANK" && form.accountNumber && form.bankName) {
        await post(`/beneficiaries/${b.id}/accounts`, {
          bankName: form.bankName,
          accountNumber: form.accountNumber,
          currency: form.currency || "PEN",
          accountType: form.accountType,
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
      <div className="text-sm font-semibold text-emerald-800 flex items-center justify-between">
        <span>
          {payoutMethod === "CASH" && "💵 Registrar Beneficiario para Efectivo"}
          {payoutMethod === "MOBILE_WALLET" && "📱 Registrar Datos para Yape"}
          {payoutMethod === "BANK" && "🏦 Registrar Beneficiario y Cuenta Bancaria"}
        </span>
      </div>
      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Nombre completo del titular"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          placeholder="Ej: Juan Pérez García"
          className={payoutMethod !== "BANK" ? "col-span-2" : ""}
        />

        {payoutMethod === "MOBILE_WALLET" && (
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-semibold text-emerald-800">📱 Número de Teléfono Yape (+51 Perú / +593 Ecuador)</label>
            <div className="flex gap-2">
              <Select
                value={phonePrefix}
                onChange={(e) => setPhonePrefix(e.target.value)}
                className="w-36 text-xs font-bold border-emerald-500"
              >
                <option value="+51">🇵🇪 +51 (Perú)</option>
                <option value="+593">🇪🇨 +593 (Ecuador)</option>
              </Select>
              <Input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Ej: 987654321"
                className="flex-1 border-emerald-500 font-bold"
              />
            </div>
          </div>
        )}

        {payoutMethod !== "MOBILE_WALLET" && (
          <>
            <Select
              label="Tipo de documento"
              value={form.documentType}
              onChange={(e) => setForm({ ...form, documentType: e.target.value })}
            >
              <option value="DNI">DNI (Perú)</option>
              <option value="CEDULA">Cédula</option>
              <option value="PASSPORT">Pasaporte</option>
              <option value="RUC">RUC</option>
            </Select>
            <Input
              label="Número de documento"
              value={form.documentNumber}
              onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
              placeholder="Ej: 47102938"
            />
          </>
        )}

        {payoutMethod === "CASH" && (
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-semibold text-slate-700">Teléfono del beneficiario (opcional)</label>
            <div className="flex gap-2">
              <Select
                value={phonePrefix}
                onChange={(e) => setPhonePrefix(e.target.value)}
                className="w-36 text-xs font-bold"
              >
                <option value="+593">🇪🇨 +593 (Ecuador)</option>
                <option value="+51">🇵🇪 +51 (Perú)</option>
              </Select>
              <Input
                placeholder="Ej: 987654321"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>
        )}

        {payoutMethod === "BANK" && (
          <>
            <Select
              label="Banco de Destino"
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            >
              <option value="BCP">BCP — Banco de Crédito del Perú</option>
              <option value="INTERBANK">Interbank</option>
              <option value="BBVA">BBVA Perú</option>
              <option value="SCOTIABANK">Scotiabank</option>
              <option value="BANCO_PICHINCHA">Banco Pichincha (Perú)</option>
              <option value="BANCO_NACION">Banco de la Nación</option>
              <option value="OTRO">Otro Banco</option>
            </Select>
            <Select
              label="Tipo de Cuenta"
              value={form.accountType}
              onChange={(e) => setForm({ ...form, accountType: e.target.value })}
            >
              <option value="AHORROS">Cuenta de Ahorros</option>
              <option value="CORRIENTE">Cuenta Corriente</option>
              <option value="CCI">CCI (Código Interbancario)</option>
            </Select>
            <Input
              label="Número de Cuenta o CCI"
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              placeholder="Ej: 193-9821039-0-81 ó CCI 20 dígitos"
              className="col-span-2"
            />
            <Select
              label="Moneda de la cuenta"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              <option value="PEN">PEN (Soles)</option>
              <option value="USD">USD (Dólares)</option>
            </Select>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Teléfono contacto (opcional)</label>
              <div className="flex gap-2">
                <Select
                  value={phonePrefix}
                  onChange={(e) => setPhonePrefix(e.target.value)}
                  className="w-32 text-xs font-bold"
                >
                  <option value="+51">🇵🇪 +51</option>
                  <option value="+593">🇪🇨 +593</option>
                </Select>
                <Input
                  placeholder="Ej: 987654321"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={submit} loading={loading}>
          Guardar beneficiario
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
  const [cashAmountReceived, setCashAmountReceived] = useState("0");
  const [sendAmount, setSendAmount] = useState("0");
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
                      `🖨️ IMPRIMIENDO TICKET DE REMESA DE VENTANILLA:\n----------------------------------------\nVALEX — CAMBIO & GIROS INT.\nCÓDIGO RETIRO: ${createdTransfer.withdrawalCode}\nREF: ${createdTransfer.reference}\nREMITENTE: ${createdTransfer.sender.fullName}\nBENEFICIARIO: ${createdTransfer.beneficiary.fullName}\nMONTO NETO A RETIRAR: ${createdTransfer.receiveAmount} ${createdTransfer.receiveCurrency}\n----------------------------------------`
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

            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <Select
                label="Forma de entrega al beneficiario"
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value as PayoutMethod)}
                className="font-bold text-blue-900"
              >
                <option value="CASH">💵 Retiro en Efectivo (Ventanilla)</option>
                <option value="MOBILE_WALLET">📱 Retiro por Yape (Perú)</option>
                <option value="BANK">🏦 Retiro por Cuenta Bancaria</option>
              </Select>
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
                payoutMethod={payoutMethod}
                onCreated={(b) => {
                  setBeneficiaries((prev) => [...prev, b]);
                  setBeneficiaryId(b.id);
                  setShowCreateBeneficiary(false);
                }}
                onCancel={() => setShowCreateBeneficiary(false)}
              />
            ) : (
              <div className="space-y-2">
                <Select
                  label={
                    payoutMethod === "CASH"
                      ? "Beneficiario (Retiro en Efectivo)"
                      : payoutMethod === "MOBILE_WALLET"
                      ? "Beneficiario Titular de Yape"
                      : "Beneficiario (Cuenta Bancaria)"
                  }
                  value={beneficiaryId}
                  onChange={(e) => setBeneficiaryId(e.target.value)}
                >
                  <option value="">Seleccionar beneficiario…</option>
                  {beneficiaries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.fullName} {b.phone ? `📱 ${b.phone}` : ""} — {b.documentType} {b.documentNumber}
                    </option>
                  ))}
                </Select>

                {beneficiaryId && payoutMethod === "MOBILE_WALLET" && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm">
                    <span className="text-xs text-emerald-800 font-semibold uppercase tracking-wider block">Número Yape Asociado:</span>
                    <span className="font-mono text-lg font-bold text-emerald-950">
                      {beneficiaries.find((b) => b.id === beneficiaryId)?.phone || "📱 Ingrese el número Yape al cotizar"}
                    </span>
                  </div>
                )}
              </div>
            )}
            {!showCreateBeneficiary && (
              <button
                onClick={() => setShowCreateBeneficiary(true)}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                + Registrar nuevo beneficiario {payoutMethod === "MOBILE_WALLET" ? "para Yape" : payoutMethod === "BANK" ? "y Cuenta Bancaria" : ""}
              </button>
            )}

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <Input
                label={`Efectivo recibido del cliente (${corridor?.fromCurrency ?? "USD"})`}
                type="number"
                min="0"
                step="0.01"
                value={sendAmount}
                onChange={(e) => {
                  setSendAmount(e.target.value);
                  setCashAmountReceived(e.target.value);
                }}
                placeholder="0"
              />

              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
                    Valor transformado a entregar ({corridor?.toCurrency ?? "PEN"})
                  </span>
                  <span className="text-xs text-emerald-600">
                    Tasa de cambio: 1 {corridor?.fromCurrency ?? "USD"} = {corridor?.fxRates?.[0]?.sellRate ?? "3.49008"} {corridor?.toCurrency ?? "PEN"}
                  </span>
                </div>
                <div className="text-xl font-extrabold text-emerald-900 font-mono">
                  {fmtMoney((Number(sendAmount) || 0) * Number(corridor?.fxRates?.[0]?.sellRate || 3.49008), corridor?.toCurrency ?? "PEN")}
                </div>
              </div>
            </div>

            <Input
              label="Series de billetes de alta denominación ($50/$100) — Opcional"
              value={highBillSerials}
              onChange={(e) => setHighBillSerials(e.target.value)}
              placeholder="Ej: B293810, C928102"
            />

            <Button onClick={() => loadQuote(Number(sendAmount))} loading={loading} className="w-full text-base py-3 font-bold">
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
              Pago recibido en {paymentMethod === "CASH" ? "efectivo en ventanilla" : "transferencia bancaria"}{" "}
              · Retiro en Perú {payoutMethod === "CASH" ? "en efectivo mediante código" : payoutMethod === "MOBILE_WALLET" ? "por Yape al teléfono móvil" : "por depósito a cuenta bancaria"} para{" "}
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

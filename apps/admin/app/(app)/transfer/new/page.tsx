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
  FeeTier,
} from "@/lib/types";

type Step = "customer" | "details" | "confirm";

const PAYOUT_LABELS: Record<PayoutMethod, string> = {
  CASH: "Efectivo (Retiro en Ventanilla)",
  BANK: "Cuenta Bancaria",
  MOBILE_WALLET: "Billetera Móvil (Yape)",
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo en Ventanilla",
  BANK_TRANSFER: "Transferencia Bancaria",
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
      <div className="text-sm font-bold text-blue-900">Registrar nuevo cliente remitente</div>
      {error && <Alert>{error}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Tipo de cliente"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option value="PERSON">Persona Natural</option>
          <option value="BUSINESS">Persona Jurídica (Empresa)</option>
        </Select>
        <Select
          label="País de residencia"
          value={form.countryId}
          onChange={(e) => handleCountryChange(e.target.value)}
        >
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code === "EC" ? "🇪🇨 Ecuador" : c.code === "PE" ? "🇵🇪 Perú" : c.name}
            </option>
          ))}
        </Select>

        <Input
          label="Nombre completo o Razón Social"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          className="col-span-2"
          placeholder="Ej. Juan Carlos Pérez"
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
          placeholder="1700000001"
        />

        <div className="col-span-2 space-y-1">
          <label className="text-xs font-semibold text-slate-700">Teléfono / WhatsApp</label>
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
    documentType: destinationCode === "PE" ? "DNI" : "CEDULA",
    documentNumber: "",
    countryId: defaultCountry?.id ?? "",
    phone: "",
    bankName: payoutMethod === "MOBILE_WALLET" ? "YAPE" : "BCP",
    accountNumber: "",
    accountType: "AHORROS",
    currency: destinationCode === "PE" ? "PEN" : "USD",
  });
  const [phonePrefix, setPhonePrefix] = useState(
    destinationCode === "PE" || payoutMethod === "MOBILE_WALLET" ? "+51" : "+593"
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.fullName) {
      setError("Ingrese el nombre completo del destinatario.");
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

      let accounts = [];
      if (payoutMethod === "BANK" && form.accountNumber && form.bankName) {
        const acc = await post<any>(`/beneficiaries/${b.id}/accounts`, {
          bankName: form.bankName,
          accountNumber: form.accountNumber,
          currency: form.currency || "PEN",
          accountType: form.accountType,
        });
        accounts.push(acc);
      }

      onCreated({ ...b, accounts });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear destinatario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50/70 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
          <span>➕</span> Registrar Nuevo Destinatario
        </span>
        <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
          {payoutMethod === "MOBILE_WALLET" ? "📱 Retiro por Yape" : payoutMethod === "BANK" ? "🏦 Cuenta Bancaria" : "💵 Retiro en Efectivo"}
        </span>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Nombre completo del destinatario"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          className="col-span-2"
          placeholder="Ej: Rosa María Flores"
          required
        />

        <Select
          label="Tipo de documento"
          value={form.documentType}
          onChange={(e) => setForm({ ...form, documentType: e.target.value })}
        >
          <option value="DNI">DNI (Perú)</option>
          <option value="CEDULA">Cédula (Ecuador)</option>
          <option value="PASSPORT">Pasaporte</option>
          <option value="RUC">RUC</option>
        </Select>

        <Input
          label="Número de documento (opcional si cobra por código)"
          value={form.documentNumber}
          onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
          placeholder="Ej: 45678901"
        />

        <div className="col-span-2 space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            {payoutMethod === "MOBILE_WALLET" ? "📱 Número de Celular Yape *" : "Teléfono / WhatsApp de notificación"}
          </label>
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

        {payoutMethod === "BANK" && (
          <>
            <Select
              label="Banco de destino"
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            >
              <option value="BCP">BCP (Banco de Crédito del Perú)</option>
              <option value="BBVA">BBVA Perú</option>
              <option value="INTERBANK">Interbank</option>
              <option value="SCOTIABANK">Scotiabank Perú</option>
              <option value="BANCO_DE_LA_NACION">Banco de la Nación</option>
              <option value="BANCO_PICHINCHA">Banco Pichincha (Ecuador)</option>
            </Select>
            <Select
              label="Tipo de cuenta"
              value={form.accountType}
              onChange={(e) => setForm({ ...form, accountType: e.target.value })}
            >
              <option value="AHORROS">Cuenta de Ahorros</option>
              <option value="CORRIENTE">Cuenta Corriente</option>
            </Select>
            <Input
              label="Número de cuenta o CCI"
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              placeholder="Ej: 191-23456789-0-12"
              className="col-span-2"
            />
          </>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={submit} loading={loading} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
          Guardar y Seleccionar Destinatario
        </Button>
      </div>
    </div>
  );
}

export default function NewTransferPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("customer");

  // Step 1: Customer
  const [docType, setDocType] = useState("CEDULA");
  const [docNumber, setDocNumber] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

  // Step 2: Beneficiary & Details
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [corridorId, setCorridorId] = useState("");
  const [feeTiers, setFeeTiers] = useState<FeeTier[]>([]);

  // Beneficiary selection state
  const [frequentBeneficiaries, setFrequentBeneficiaries] = useState<Beneficiary[]>([]);
  const [beneficiarySearch, setBeneficiarySearch] = useState("");
  const [searchResults, setSearchResults] = useState<Beneficiary[]>([]);
  const [searchingBeneficiaries, setSearchingBeneficiaries] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [showCreateBeneficiary, setShowCreateBeneficiary] = useState(false);

  // Transfer options
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("CASH");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [remittanceReason, setRemittanceReason] = useState("Ayuda Familiar / Remesa");
  const [sourceOfFunds, setSourceOfFunds] = useState("Sueldo/Honorarios");
  const [highBillSerials, setHighBillSerials] = useState("");
  const [sendAmount, setSendAmount] = useState("");

  // Step 3: Quote & Confirm
  const [quote, setQuote] = useState<Quote | null>(null);
  const [createdTransfer, setCreatedTransfer] = useState<Transfer | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    Promise.all([get<Country[]>("/fx/countries"), get<FeeTier[]>("/fees/tiers")])
      .then(([cs, tiers]) => {
        if (!ignore) {
          setCountries(cs);
          setFeeTiers(tiers);
        }
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  // Search beneficiaries globally
  useEffect(() => {
    if (!beneficiarySearch || beneficiarySearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingBeneficiaries(true);
      try {
        const res = await get<Beneficiary[]>(`/beneficiaries?search=${encodeURIComponent(beneficiarySearch.trim())}`);
        setSearchResults(res);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchingBeneficiaries(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [beneficiarySearch]);

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
    setFrequentBeneficiaries(bens);
    if (active.length > 0) setCorridorId(active[0].id);

    // NO forzar ningún beneficiario al iniciar
    setBeneficiaryId("");
    setSelectedBeneficiary(null);
    setShowCreateBeneficiary(false);
    setBeneficiarySearch("");
  };

  const handleSelectBeneficiary = (b: Beneficiary) => {
    setSelectedBeneficiary(b);
    setBeneficiaryId(b.id);
    setShowCreateBeneficiary(false);
    setBeneficiarySearch("");
  };

  const handleClearBeneficiary = () => {
    setSelectedBeneficiary(null);
    setBeneficiaryId("");
    setBeneficiarySearch("");
  };

  const corridor = corridors.find((c) => c.id === corridorId);
  const sellRate = corridor && corridor.fxRates[0] ? Number(corridor.fxRates[0].sellRate) : 3.75;
  const sendAmountNum = Number(sendAmount || "0");

  // Dynamic Live Calculation
  let grossPen = sendAmountNum;
  if (corridor?.direction === "EC_TO_PE") {
    grossPen = sendAmountNum * sellRate;
  }
  const matchedTier = feeTiers.find((t) => grossPen >= Number(t.minAmountPen) && grossPen <= Number(t.maxAmountPen)) || feeTiers[0];
  const feeUsd = matchedTier ? Number(matchedTier.feeUsd) : 1;
  const feePen = matchedTier && matchedTier.feePen ? Number(matchedTier.feePen) : Number((feeUsd * sellRate).toFixed(2));

  // Dual-Box amounts
  const isEcToPe = corridor?.direction === "EC_TO_PE";
  const depositBoxTotal = isEcToPe ? sendAmountNum + feeUsd : sendAmountNum + feePen;
  const payoutBoxNet = isEcToPe
    ? Math.max(0, (sendAmountNum * sellRate) - feePen)
    : Math.max(0, (sendAmountNum / sellRate) - feeUsd);

  const loadQuote = async () => {
    if (!corridorId || !customer) return;
    if (!beneficiaryId) {
      alert("Por favor seleccione o registre un destinatario para continuar.");
      return;
    }
    if (sendAmountNum <= 0) {
      alert("Ingrese un monto válido a enviar.");
      return;
    }

    setLoading(true);
    try {
      const q = await post<Quote>("/quotes", {
        corridorId,
        sendAmount: sendAmountNum,
        sendCurrency: corridor?.fromCurrency,
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
            ? selectedBeneficiary?.accounts?.[0]?.id
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

  if (createdTransfer) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Card title="✅ Transferencia Generada con Éxito">
          <div className="space-y-4 text-center">
            <div className="rounded-2xl bg-gradient-to-b from-emerald-50 to-teal-50/80 p-5 border-2 border-emerald-300 shadow-sm">
              <div className="text-xs text-emerald-800 uppercase tracking-widest font-black flex items-center justify-center gap-1.5">
                <span>🔑</span> CÓDIGO ÚNICO DE RETIRO
              </div>
              <div className="font-mono text-3xl sm:text-4xl font-black text-emerald-950 my-2.5 tracking-widest select-all">
                {createdTransfer.withdrawalCode}
              </div>
              <div className="flex items-center justify-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (createdTransfer.withdrawalCode) {
                      navigator.clipboard.writeText(createdTransfer.withdrawalCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 3000);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 bg-emerald-200/90 hover:bg-emerald-300 px-3.5 py-1.5 rounded-lg transition-all shadow-xs"
                >
                  <span>{copiedCode ? "✅" : "📋"}</span>
                  <span>{copiedCode ? "¡Código Copiado!" : "Copiar Código"}</span>
                </button>
              </div>
              <div className="text-xs text-emerald-700 mt-2.5 font-medium">
                Entrega este código al remitente. El beneficiario lo requerirá para retirar en ventanilla o recibir por Yape/Banco.
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
                <span className="text-xs text-slate-500 block">Cobrado en Caja Emisora:</span>
                <span className="font-extrabold text-slate-900">{fmtMoney(createdTransfer.sendAmount, createdTransfer.sendCurrency)}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Beneficiario / Destino:</span>
                <span className="font-semibold text-slate-800">{createdTransfer.beneficiary.fullName}</span>
              </div>
              <div className="col-span-2 p-2 bg-emerald-100 rounded-lg">
                <span className="text-xs text-emerald-800 block font-bold">Monto Neto a Pagar en Destino:</span>
                <span className="text-xl font-black text-emerald-950">{fmtMoney(createdTransfer.receiveAmount, createdTransfer.receiveCurrency)}</span>
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
                  📲 Enviar Notificación WhatsApp
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() =>
                    alert(
                      `🖨️ IMPRIMIENDO TICKET DE REMESA DE VENTANILLA:\n----------------------------------------\nVALEX — CAMBIO & GIROS INT.\nCÓDIGO RETIRO: ${createdTransfer.withdrawalCode}\nREF: ${createdTransfer.reference}\nREMITENTE: ${createdTransfer.sender.fullName}\nBENEFICIARIO: ${createdTransfer.beneficiary.fullName}\nCOBRADO EN CAJA ORIGEN: ${createdTransfer.sendAmount} ${createdTransfer.sendCurrency}\nNETO A RETIRAR EN DESTINO: ${createdTransfer.receiveAmount} ${createdTransfer.receiveCurrency}\n----------------------------------------`
                    )
                  }
                >
                  🖨️ Imprimir Ticket Ventanilla
                </Button>
              </div>
              <Button
                variant="primary"
                className="w-full mt-1 bg-[#475569] hover:bg-slate-700 text-white font-bold"
                onClick={() => {
                  setCreatedTransfer(null);
                  setStep("customer");
                  setDocNumber("");
                  setCustomer(null);
                  setSelectedBeneficiary(null);
                  setBeneficiaryId("");
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
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#475569] text-white p-4 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <span>💸</span> Nueva Operación de Ventanilla
          </h1>
          <p className="text-xs text-[#00E5FF] font-semibold">
            VALEX Express · Envío de Giros Internacionales y Cobro de Comisiones
          </p>
        </div>
        <div className="text-right text-xs">
          <span className="text-slate-300">Paso actual: </span>
          <span className="font-bold text-[#00E5FF] uppercase">
            {step === "customer" ? "1. Remitente" : step === "details" ? "2. Datos & Destinatario" : "3. Confirmación"}
          </span>
        </div>
      </div>

      {step === "customer" && (
        <Card title="Paso 1 — Identificar Cliente Remitente">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Tipo de documento"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                <option value="CEDULA">Cédula (Ecuador)</option>
                <option value="DNI">DNI (Perú)</option>
                <option value="RUC">RUC</option>
                <option value="PASSPORT">Pasaporte</option>
              </Select>
              <Input
                label="Número de documento"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="Ej. 1700000001"
              />
            </div>
            {customerError && <Alert>{customerError}</Alert>}
            <Button onClick={searchCustomer} loading={loading} className="w-full bg-[#475569] hover:bg-slate-700 text-white font-bold py-2.5">
              Buscar Cliente Remitente
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
        <Card title="Paso 2 — Destinatario, Valores y Comisiones">
          <div className="space-y-5">
            {/* Customer Header */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">{customer.fullName}</div>
                <div className="text-xs text-slate-500">
                  {customer.documentType} {customer.documentNumber} {customer.phone ? `· 📱 ${customer.phone}` : ""}
                </div>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 font-bold">
                KYC {customer.kycStatus}
              </Badge>
            </div>

            {/* Payout & Corridor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Corredor de Giro"
                value={corridorId}
                onChange={(e) => setCorridorId(e.target.value)}
                className="font-bold text-slate-800"
              >
                {corridors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fromCountry.name} ({c.fromCurrency}) → {c.toCountry.name} ({c.toCurrency})
                  </option>
                ))}
              </Select>

              <Select
                label="Forma de entrega en destino"
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value as PayoutMethod)}
                className="font-bold text-slate-800"
              >
                <option value="CASH">💵 Retiro en Efectivo (Ventanilla)</option>
                <option value="MOBILE_WALLET">📱 Retiro por Yape (Perú)</option>
                <option value="BANK">🏦 Retiro por Cuenta Bancaria</option>
              </Select>
            </div>

            {/* SECTION: BENEFICIARY SELECTION */}
            <div className="border-t border-b border-slate-200 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>👤</span>
                  <span>Destinatario de la Transferencia</span>
                </label>
                {!selectedBeneficiary && !showCreateBeneficiary && (
                  <button
                    onClick={() => setShowCreateBeneficiary(true)}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1"
                  >
                    <span>➕</span> Registrar Nuevo Destinatario
                  </button>
                )}
              </div>

              {/* Case A: Beneficiary is selected */}
              {selectedBeneficiary && (
                <div className="rounded-xl bg-cyan-50/70 border-2 border-[#00E5FF] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        ✓ DESTINATARIO SELECCIONADO
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-600">
                        {selectedBeneficiary.documentType} {selectedBeneficiary.documentNumber}
                      </span>
                    </div>
                    <div className="text-base font-extrabold text-slate-900 mt-1">
                      {selectedBeneficiary.fullName}
                    </div>
                    {selectedBeneficiary.phone && (
                      <div className="text-xs font-semibold text-slate-600 mt-0.5">
                        📱 Contacto / Yape: <span className="font-mono text-slate-900 font-bold">{selectedBeneficiary.phone}</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={handleClearBeneficiary}
                    className="text-xs font-bold text-slate-700 hover:bg-slate-200 py-1.5 px-3"
                  >
                    🔄 Cambiar Destinatario
                  </Button>
                </div>
              )}

              {/* Case B: Creating new beneficiary */}
              {!selectedBeneficiary && showCreateBeneficiary && (
                <CreateBeneficiaryForm
                  customerId={customer.id}
                  countries={countries}
                  destinationCode={corridor?.toCountry.code ?? "PE"}
                  payoutMethod={payoutMethod}
                  onCreated={handleSelectBeneficiary}
                  onCancel={() => setShowCreateBeneficiary(false)}
                />
              )}

              {/* Case C: Searching or Picking from Frequent list */}
              {!selectedBeneficiary && !showCreateBeneficiary && (
                <div className="space-y-3">
                  {/* Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={beneficiarySearch}
                      onChange={(e) => setBeneficiarySearch(e.target.value)}
                      placeholder="🔍 Buscar por nombre, DNI, Cédula o teléfono móvil..."
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-[#00E5FF] focus:outline-none bg-slate-50"
                    />
                    {searchingBeneficiaries && (
                      <span className="absolute right-3.5 top-3 text-xs text-slate-400 font-medium">
                        Buscando...
                      </span>
                    )}
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-xs space-y-1 max-h-48 overflow-y-auto">
                      <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1">
                        Resultados encontrados:
                      </div>
                      {searchResults.map((b) => (
                        <div
                          key={b.id}
                          onClick={() => handleSelectBeneficiary(b)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-cyan-50 cursor-pointer transition-colors border border-transparent hover:border-cyan-200"
                        >
                          <div>
                            <span className="font-bold text-sm text-slate-900">{b.fullName}</span>
                            <span className="text-xs text-slate-500 ml-2">
                              ({b.documentType} {b.documentNumber}) {b.phone ? `📱 ${b.phone}` : ""}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-blue-700">Seleccionar ➔</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Frequent Beneficiaries of this sender */}
                  {frequentBeneficiaries.length > 0 && !beneficiarySearch && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-500">
                        Destinatarios anteriores de este remitente:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {frequentBeneficiaries.map((b) => (
                          <div
                            key={b.id}
                            onClick={() => handleSelectBeneficiary(b)}
                            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-cyan-50 hover:border-[#00E5FF] cursor-pointer transition-all flex items-center justify-between text-xs"
                          >
                            <div className="truncate pr-2">
                              <div className="font-bold text-slate-800 truncate">{b.fullName}</div>
                              <div className="text-[11px] text-slate-500">
                                {b.documentType} {b.documentNumber}
                              </div>
                            </div>
                            <span className="text-xs text-[#00E5FF] font-black">Elegir</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* DUAL-BOX COMMISSION & CASH CALCULATION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Monto Principal a Enviar ({corridor?.fromCurrency ?? "USD"})
                </label>
                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Tipo de Cambio: 1 {corridor?.fromCurrency ?? "USD"} = {sellRate} {corridor?.toCurrency ?? "PEN"}
                </span>
              </div>

              <Input
                type="number"
                min="1"
                step="any"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                placeholder="100"
                className="text-lg font-black text-slate-900"
              />

              {/* Dual-Box Symmetric Display */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Deposit Box Card */}
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-900 flex items-center gap-1">
                      <span>📥</span> CAJA DE DEPÓSITO (ORIGEN)
                    </span>
                    <span className="text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">
                      AUMENTA CAJA
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-0.5 pt-1">
                    <div className="flex justify-between">
                      <span>Monto Principal:</span>
                      <span className="font-semibold">{fmtMoney(sendAmountNum, corridor?.fromCurrency ?? "USD")}</span>
                    </div>
                    <div className="flex justify-between text-blue-800 font-medium">
                      <span>(+) Comisión Emisión:</span>
                      <span>+ {isEcToPe ? `$${feeUsd.toFixed(2)} USD` : `S/. ${feePen.toFixed(2)} PEN`}</span>
                    </div>
                  </div>
                  <div className="border-t border-blue-200 pt-1.5 flex justify-between items-center">
                    <span className="text-xs font-extrabold text-blue-950 uppercase">Total a Cobrar:</span>
                    <span className="text-lg font-black text-blue-950">
                      {fmtMoney(depositBoxTotal, corridor?.fromCurrency ?? "USD")}
                    </span>
                  </div>
                </div>

                {/* Payout Box Card */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-950 flex items-center gap-1">
                      <span>📤</span> CAJA DE RETIRO (DESTINO)
                    </span>
                    <span className="text-amber-800 font-bold bg-amber-100 px-1.5 py-0.5 rounded text-[10px]">
                      DISMINUYE CAJA
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-0.5 pt-1">
                    <div className="flex justify-between">
                      <span>Monto Convertido:</span>
                      <span className="font-semibold">
                        {fmtMoney(isEcToPe ? sendAmountNum * sellRate : sendAmountNum / sellRate, corridor?.toCurrency ?? "PEN")}
                      </span>
                    </div>
                    <div className="flex justify-between text-amber-800 font-medium">
                      <span>(-) Comisión Retiro:</span>
                      <span>- {isEcToPe ? `S/. ${feePen.toFixed(2)} PEN` : `$${feeUsd.toFixed(2)} USD`}</span>
                    </div>
                  </div>
                  <div className="border-t border-emerald-200 pt-1.5 flex justify-between items-center">
                    <span className="text-xs font-extrabold text-emerald-950 uppercase">Neto a Entregar:</span>
                    <span className="text-lg font-black text-emerald-900">
                      {fmtMoney(payoutBoxNet, corridor?.toCurrency ?? "PEN")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Input
              label="Series de billetes de alta denominación ($50/$100) — Opcional"
              value={highBillSerials}
              onChange={(e) => setHighBillSerials(e.target.value)}
              placeholder="Ej: B293810, C928102"
            />

            <Button
              onClick={loadQuote}
              loading={loading}
              className="w-full text-base py-3 font-bold bg-[#475569] hover:bg-slate-700 text-white shadow-md"
            >
              Cotizar y Continuar al Resumen ➔
            </Button>
          </div>
        </Card>
      )}

      {step === "confirm" && quote && corridor && (
        <Card title="Paso 3 — Confirmación de Operación y Emisión de Código">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-blue-50 p-3.5 border border-blue-200">
                <div className="text-xs font-bold text-blue-900 uppercase">Monto Total Cobrado en Origen</div>
                <div className="text-xl font-black text-blue-950 mt-1">
                  {fmtMoney(quote.sendAmount, quote.sendCurrency)}
                </div>
                <div className="text-[11px] text-blue-700 mt-0.5">
                  (Incluye comisión de emisión: {fmtMoney(quote.feeAmount, quote.feeCurrency || quote.sendCurrency)})
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 p-3.5 border border-emerald-200">
                <div className="text-xs font-bold text-emerald-900 uppercase">Monto Neto a Entregar en Destino</div>
                <div className="text-xl font-black text-emerald-950 mt-1">
                  {fmtMoney(quote.receiveAmount, quote.receiveCurrency)}
                </div>
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  (Descontada comisión de retiro)
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">Destinatario: </span>
                <span>{selectedBeneficiary?.fullName}</span> ({selectedBeneficiary?.documentType} {selectedBeneficiary?.documentNumber})
              </div>
              <div className="font-mono font-bold text-slate-700">
                TC: 1 {corridor.fromCurrency} = {quote.fxRate} {corridor.toCurrency}
              </div>
            </div>

            <Alert kind="info">
              Pago recibido en <strong>{PAYMENT_LABELS[paymentMethod]}</strong>. Entrega en destino mediante <strong>{PAYOUT_LABELS[payoutMethod]}</strong> para <strong>{selectedBeneficiary?.fullName}</strong>.
            </Alert>

            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setStep("details")}
                disabled={loading}
              >
                Atrás
              </Button>
              <Button
                onClick={confirm}
                loading={loading}
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 shadow-md"
              >
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

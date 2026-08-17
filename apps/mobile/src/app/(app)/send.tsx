import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Alert,
  Badge,
  Button,
  Card,
  COLORS,
  Input,
  Screen,
  Select,
  Spinner,
} from "@/components/ui";
import { get, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtMoney } from "@/lib/format";
import type {
  Beneficiary,
  Corridor,
  Country,
  Customer,
  PaymentMethod,
  PayoutMethod,
  Quote,
  Transfer,
} from "@/lib/types";

type Step = "amount" | "beneficiary" | "method" | "confirm";

function AddBeneficiaryModal({
  visible,
  onClose,
  customerId,
  countries,
  destinationCode,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  customerId: string;
  countries: Country[];
  destinationCode: string;
  onCreated: (b: Beneficiary) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState("DNI");
  const [documentNumber, setDocumentNumber] = useState("");
  const [countryId, setCountryId] = useState(
    countries.find((c) => c.code === destinationCode)?.id ?? "",
  );
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setCountryId(countries.find((c) => c.code === destinationCode)?.id ?? "");
      setFullName("");
      setDocumentNumber("");
      setBankName("");
      setAccountNumber("");
      setError(null);
    }
  }, [visible, countries, destinationCode]);

  const submit = async () => {
    if (!fullName || !documentNumber) return setError("Completa nombre y documento.");
    setError(null);
    setLoading(true);
    try {
      const b = await post<Beneficiary>("/beneficiaries", {
        customerId,
        fullName,
        documentType,
        documentNumber,
        countryId,
      });
      if (bankName && accountNumber) {
        await post(`/beneficiaries/${b.id}/accounts`, {
          bankName,
          accountNumber,
          currency: "PEN",
        });
      }
      onCreated({ ...b, accounts: [] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear beneficiario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }} onPress={onClose}>
        <View style={{ backgroundColor: COLORS.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "85%" }}>
          <Text style={{ fontWeight: "800", fontSize: 18, marginBottom: 12 }}>Nuevo beneficiario</Text>
          <ScrollView>
            {error && <Alert>{error}</Alert>}
            <Input label="Nombre completo" value={fullName} onChangeText={setFullName} />
            <Select
              label="Tipo de documento"
              value={documentType}
              options={[
                { label: "DNI (PE)", value: "DNI" },
                { label: "Cédula (EC)", value: "CEDULA" },
                { label: "Pasaporte", value: "PASSPORT" },
              ]}
              onChange={setDocumentType}
            />
            <Input label="Número de documento" value={documentNumber} onChangeText={setDocumentNumber} />
            <Select
              label="País"
              value={countryId}
              options={countries.map((c) => ({ label: c.name, value: c.id }))}
              onChange={setCountryId}
            />
            <Text style={{ fontWeight: "700", color: COLORS.slate600, marginTop: 8 }}>Cuenta bancaria (opcional)</Text>
            <Input label="Banco" value={bankName} onChangeText={setBankName} placeholder="BCP, Banco Pichincha…" />
            <Input label="Número de cuenta" value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" />
            <Button title="Guardar beneficiario" onPress={submit} loading={loading} />
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function SendScreen() {
  const { hydrated } = useAuth();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);

  const [step, setStep] = useState<Step>("amount");
  const [corridorId, setCorridorId] = useState("");
  const [amount, setAmount] = useState("100");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("CASH");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [remittanceReason, setRemittanceReason] = useState("Ayuda Familiar / Remesa");
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    let mounted = true;
    (async () => {
      try {
        const [me, cors, cs] = await Promise.all([
          get<Customer>("/customers/me"),
          get<Corridor[]>("/fx/corridors"),
          get<Country[]>("/fx/countries"),
        ]);
        if (!mounted) return;
        setCustomer(me);
        const active = cors.filter((c) => c.active);
        setCorridors(active);
        setCorridorId(active[0]?.id ?? "");
        setCountries(cs);
        const bens = await get<Beneficiary[]>(`/beneficiaries/customer/${me.id}`);
        if (mounted) setBeneficiaries(bens);
      } catch {
        if (mounted) setError("No se pudieron cargar los datos. Revisa la conexión.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [hydrated]);

  const corridor = corridors.find((c) => c.id === corridorId);

  const requestQuote = async () => {
    if (!customer || !corridor) return;
    setError(null);
    setLoading(true);
    try {
      const q = await post<Quote>("/quotes", {
        corridorId: corridor.id,
        sendAmount: Number(amount),
        sendCurrency: corridor.fromCurrency,
        senderCustomerId: customer.id,
      });
      setQuote(q);
      setStep("beneficiary");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cotizar");
    } finally {
      setLoading(false);
    }
  };

  const createTransfer = async () => {
    if (!quote || !customer || !beneficiaryId) return;
    setError(null);
    setLoading(true);
    try {
      const t = await post<Transfer>("/transfers", {
        quoteId: quote.id,
        senderCustomerId: customer.id,
        beneficiaryId,
        payoutMethod,
        paymentMethod,
        remittanceReason,
        payoutAccountId: payoutMethod === "BANK" ? accountId || undefined : undefined,
      });
      router.replace(`/operation/${t.id}?created=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la operación");
    } finally {
      setLoading(false);
    }
  };

  const selectedBeneficiary = beneficiaries.find((b) => b.id === beneficiaryId);

  if (!customer) {
    return (
      <Screen>
        {error && <Alert>{error}</Alert>}
        <Spinner />
      </Screen>
    );
  }

  if (customer.kycStatus !== "APPROVED") {
    return (
      <Screen>
        <Alert kind="info">
          Tu cuenta está en revisión (KYC {customer.kycStatus}). No puedes enviar dinero hasta que se apruebe.
        </Alert>
        <Button title="Volver" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.slate900, marginBottom: 12 }}>
        Enviar dinero
      </Text>
      {error && <Alert>{error}</Alert>}

      {step === "amount" && (
        <Card>
          <Select
            label="Corredor"
            value={corridorId}
            options={corridors.map((c) => ({
              label: `${c.fromCountry.code} → ${c.toCountry.code}`,
              value: c.id,
            }))}
            onChange={setCorridorId}
          />
          <Input
            label={`Monto a enviar (${corridor?.fromCurrency ?? ""})`}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <Button title="Cotizar" onPress={requestQuote} loading={loading} />
        </Card>
      )}

      {step === "beneficiary" && quote && (
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ color: COLORS.slate600 }}>Envías</Text>
            <Text style={{ fontWeight: "800" }}>{fmtMoney(quote.sendAmount, quote.sendCurrency)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ color: COLORS.slate600 }}>Comisión</Text>
            <Text>{fmtMoney(quote.feeAmount, quote.sendCurrency)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ color: COLORS.slate600 }}>Tipo de cambio</Text>
            <Text>{quote.fxRate}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ color: COLORS.slate600 }}>Recibe</Text>
            <Text style={{ fontWeight: "800", color: COLORS.success }}>
              {fmtMoney(quote.receiveAmount, quote.receiveCurrency)}
            </Text>
          </View>
          {beneficiaries.length === 0 ? (
            <>
              <Text style={{ color: COLORS.slate600, marginBottom: 8 }}>
                Aún no tienes beneficiarios.
              </Text>
              <Button title="+ Crear beneficiario" onPress={() => setModalOpen(true)} />
            </>
          ) : (
            <Select
              label="Beneficiario"
              value={beneficiaryId}
              options={beneficiaries.map((b) => ({
                label: `${b.fullName} — ${b.documentType} ${b.documentNumber}`,
                value: b.id,
              }))}
              onChange={(v) => {
                setBeneficiaryId(v);
                setAccountId("");
              }}
            />
          )}
          {beneficiaries.length > 0 && (
            <Text
              onPress={() => setModalOpen(true)}
              style={{ color: COLORS.primary, fontWeight: "600", textAlign: "center", marginTop: 8 }}
            >
              + Añadir otro beneficiario
            </Text>
          )}
          <Button title="Continuar" onPress={() => setStep("method")} disabled={!beneficiaryId} />
          <View style={{ height: 8 }} />
          <Button title="Volver" variant="secondary" onPress={() => setStep("amount")} />
        </Card>
      )}

      {step === "method" && (
        <Card>
          <Select
            label="¿Cómo recibirá el dinero?"
            value={payoutMethod}
            options={[
              { label: "Efectivo (retiro en oficina)", value: "CASH" },
              { label: "Cuenta bancaria", value: "BANK" },
            ]}
            onChange={(v) => setPayoutMethod(v as PayoutMethod)}
          />
          {payoutMethod === "BANK" && (
            <Select
              label="Cuenta del beneficiario"
              value={accountId}
              options={(selectedBeneficiary?.accounts ?? []).map((a) => ({
                label: `${a.bankName} ••••${a.accountNumber.slice(-4)} (${a.currency})`,
                value: a.id,
              }))}
              onChange={setAccountId}
            />
          )}
          <Select
            label="¿Cómo vas a pagar?"
            value={paymentMethod}
            options={[
              { label: "Transferencia bancaria", value: "BANK_TRANSFER" },
              { label: "Efectivo en oficina", value: "CASH" },
            ]}
            onChange={(v) => setPaymentMethod(v as PaymentMethod)}
          />
          <Select
            label="Motivo del envío (Regulación AML)"
            value={remittanceReason}
            options={[
              { label: "Ayuda Familiar / Remesa", value: "Ayuda Familiar / Remesa" },
              { label: "Gastos Médicos / Salud", value: "Gastos Médicos / Salud" },
              { label: "Pago Proveedor Comercial", value: "Pago Proveedor Comercial" },
              { label: "Educación / Estudios", value: "Educación / Estudios" },
              { label: "Compra de Bienes / Servicios", value: "Compra de Bienes / Servicios" },
            ]}
            onChange={setRemittanceReason}
          />
          <Button
            title="Confirmar"
            onPress={() => setStep("confirm")}
            disabled={payoutMethod === "BANK" && !accountId}
          />
          <View style={{ height: 8 }} />
          <Button title="Volver" variant="secondary" onPress={() => setStep("beneficiary")} />
        </Card>
      )}

      {step === "confirm" && quote && (
        <Card>
          <Text style={{ fontWeight: "800", fontSize: 16, marginBottom: 8 }}>Resumen</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ color: COLORS.slate600 }}>Envías</Text>
            <Text style={{ fontWeight: "700" }}>{fmtMoney(quote.sendAmount, quote.sendCurrency)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ color: COLORS.slate600 }}>Recibe el beneficiario</Text>
            <Text style={{ fontWeight: "700", color: COLORS.success }}>
              {fmtMoney(quote.receiveAmount, quote.receiveCurrency)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ color: COLORS.slate600 }}>Beneficiario</Text>
            <Text style={{ fontWeight: "700" }}>{selectedBeneficiary?.fullName}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ color: COLORS.slate600 }}>Entrega</Text>
            <Badge
              text={payoutMethod === "BANK" ? "Cuenta bancaria" : "Efectivo"}
              color={payoutMethod === "BANK" ? COLORS.primary : COLORS.warning}
            />
          </View>
          <Button title="Confirmar y enviar" onPress={createTransfer} loading={loading} />
          <View style={{ height: 8 }} />
          <Button title="Volver" variant="secondary" onPress={() => setStep("method")} />
        </Card>
      )}

      <AddBeneficiaryModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        customerId={customer.id}
        countries={countries}
        destinationCode={corridor?.toCountry.code ?? "PE"}
        onCreated={(b) => {
          setBeneficiaries((prev) => [...prev, b]);
          setBeneficiaryId(b.id);
        }}
      />
    </Screen>
  );
}

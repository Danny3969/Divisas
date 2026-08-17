import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
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
import type { Beneficiary, Country, Customer } from "@/lib/types";

export default function BeneficiariesScreen() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState("DNI");
  const [documentNumber, setDocumentNumber] = useState("");
  const [countryId, setCountryId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const me = await get<Customer>("/customers/me");
      setCustomer(me);
      const [bens, cs] = await Promise.all([
        get<Beneficiary[]>(`/beneficiaries/customer/${me.id}`),
        get<Country[]>("/fx/countries"),
      ]);
      setBeneficiaries(bens);
      setCountries(cs);
      setCountryId(cs.find((c) => c.code === "PE")?.id ?? cs[0]?.id ?? "");
    } catch {
      setError("No se pudieron cargar tus beneficiarios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const save = async () => {
    if (!customer) return;
    if (!fullName || !documentNumber) return setError("Completa nombre y documento.");
    setError(null);
    setSaving(true);
    try {
      const b = await post<Beneficiary>("/beneficiaries", {
        customerId: customer.id,
        fullName,
        documentType,
        documentNumber,
        countryId,
      });
      if (bankName && accountNumber) {
        await post(`/beneficiaries/${b.id}/accounts`, { bankName, accountNumber, currency: "PEN" });
      }
      setModalOpen(false);
      setFullName("");
      setDocumentNumber("");
      setBankName("");
      setAccountNumber("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.slate900, marginBottom: 12 }}>
        Beneficiarios
      </Text>
      {error && <Alert>{error}</Alert>}

      {loading ? (
        <Spinner />
      ) : beneficiaries.length === 0 ? (
        <Text style={{ color: COLORS.slate400, textAlign: "center", marginVertical: 24 }}>
          No tienes beneficiarios registrados.
        </Text>
      ) : (
        beneficiaries.map((b) => (
          <Card key={b.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: COLORS.slate900 }}>{b.fullName}</Text>
                <Text style={{ color: COLORS.slate600, fontSize: 13 }}>
                  {b.documentType} {b.documentNumber}
                </Text>
              </View>
              <Badge text={b.accounts?.length ? `${b.accounts.length} cuenta(s)` : "Sin cuenta"} />
            </View>
            {b.accounts?.map((a) => (
              <View key={a.id} style={{ marginTop: 8, backgroundColor: COLORS.slate50, borderRadius: 8, padding: 8 }}>
                <Text style={{ fontSize: 13, color: COLORS.slate900 }}>
                  {a.bankName} ••••{a.accountNumber.slice(-4)} ({a.currency})
                </Text>
              </View>
            ))}
          </Card>
        ))
      )}

      <Button title="+ Nuevo beneficiario" onPress={() => setModalOpen(true)} />

      <Modal visible={modalOpen} transparent animationType="slide">
        <Pressable style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => setModalOpen(false)}>
          <View style={{ backgroundColor: COLORS.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "88%" }}>
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
              <Input label="Número de documento" value={documentNumber} onChangeText={setDocumentNumber} keyboardType="numeric" />
              <Select
                label="País"
                value={countryId}
                options={countries.map((c) => ({ label: c.name, value: c.id }))}
                onChange={setCountryId}
              />
              <Text style={{ fontWeight: "700", color: COLORS.slate600, marginTop: 8 }}>Cuenta bancaria (opcional)</Text>
              <Input label="Banco" value={bankName} onChangeText={setBankName} placeholder="BCP, Banco Pichincha…" />
              <Input label="Número de cuenta" value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" />
              <Button title="Guardar" onPress={save} loading={saving} />
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

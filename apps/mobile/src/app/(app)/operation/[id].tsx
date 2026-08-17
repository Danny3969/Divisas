import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Alert,
  Badge,
  Button,
  Card,
  COLORS,
  Input,
  Screen,
  Spinner,
} from "@/components/ui";
import { get, post } from "@/lib/api";
import { fmtMoney, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import type { Transfer } from "@/lib/types";

export default function OperationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string; created?: string }>();
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [bankName, setBankName] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setTransfer(await get<Transfer>(`/transfers/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la operación");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const registerPayment = async () => {
    if (!transfer) return;
    if (!bankName) return setPayError("Indica el banco desde el que envías.");
    setPayError(null);
    setPaying(true);
    try {
      await post("/payments/bank", {
        transferId: transfer.id,
        amount: Number(transfer.sendAmount),
        currency: transfer.sendCurrency,
        bankName,
        transactionRef: transactionRef || undefined,
      });
      setPayOpen(false);
      await load();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Error al registrar el pago");
    } finally {
      setPaying(false);
    }
  };

  const canRegisterPayment =
    transfer?.paymentMethod === "BANK_TRANSFER" &&
    (transfer.status === "CONFIRMED" || transfer.status === "AWAITING_PAYMENT");

  if (loading) return <Screen><Spinner /></Screen>;
  if (error || !transfer) return <Screen><Alert>{error ?? "No encontrada"}</Alert></Screen>;

  const events = transfer.events ?? [];

  return (
    <Screen>
      <ScrollView>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.slate900 }}>
            {transfer.reference}
          </Text>
          <Badge text={STATUS_LABELS[transfer.status]} color={STATUS_COLORS[transfer.status]} />
        </View>

        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ color: COLORS.slate600 }}>Envías</Text>
            <Text style={{ fontWeight: "800" }}>{fmtMoney(transfer.sendAmount, transfer.sendCurrency)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ color: COLORS.slate600 }}>Comisión</Text>
            <Text>{fmtMoney(transfer.feeAmount, transfer.feeCurrency ?? transfer.sendCurrency)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ color: COLORS.slate600 }}>Tipo de cambio</Text>
            <Text>{transfer.fxRate}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: COLORS.slate600 }}>Recibe</Text>
            <Text style={{ fontWeight: "800", color: COLORS.success }}>
              {fmtMoney(transfer.receiveAmount, transfer.receiveCurrency)}
            </Text>
          </View>
        </Card>

        <Card>
          <Text style={{ fontWeight: "700", color: COLORS.slate900, marginBottom: 4 }}>
            Beneficiario
          </Text>
          <Text style={{ color: COLORS.slate600 }}>
            {transfer.beneficiary?.fullName} — {transfer.beneficiary?.documentType}{" "}
            {transfer.beneficiary?.documentNumber}
          </Text>
          <Text style={{ color: COLORS.slate600, fontSize: 13, marginTop: 4 }}>
            Entrega: {transfer.payoutMethod === "BANK" ? "Cuenta bancaria" : "Efectivo en oficina"}
          </Text>
        </Card>

        {transfer.payoutMethod === "CASH" && transfer.status !== "COMPLETED" && transfer.withdrawalCode && (
          <Card style={{ backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary }}>
            <Text style={{ color: COLORS.primary, fontWeight: "700", marginBottom: 4 }}>
              Código de retiro
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.slate900, letterSpacing: 2 }}>
              {transfer.withdrawalCode}
            </Text>
            <Text style={{ color: COLORS.slate600, fontSize: 12, marginTop: 4 }}>
              El beneficiario debe presentar documento y este código en la oficina para retirar.
            </Text>
          </Card>
        )}

        {canRegisterPayment && (
          <Card style={{ backgroundColor: "#F0F9FF", borderColor: "#0284C7" }}>
            <Text style={{ fontWeight: "800", color: "#0369A1", fontSize: 16, marginBottom: 4 }}>
              Instrucciones de Pago Bancario
            </Text>
            <Text style={{ color: COLORS.slate600, fontSize: 13, marginBottom: 8 }}>
              Realiza tu transferencia por <Text style={{ fontWeight: "800", color: COLORS.slate900 }}>{fmtMoney(transfer.sendAmount, transfer.sendCurrency)}</Text> a nuestra cuenta oficial:
            </Text>
            
            {transfer.sendCurrency === "USD" ? (
              <View style={{ backgroundColor: COLORS.white, padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: COLORS.slate200 }}>
                <Text style={{ fontWeight: "700", color: COLORS.slate900 }}>🏦 Banco Pichincha (Ecuador)</Text>
                <Text style={{ color: COLORS.slate600, fontSize: 13 }}>Cta Corriente: <Text style={{ fontWeight: "700" }}>2100123456</Text></Text>
                <Text style={{ color: COLORS.slate600, fontSize: 13 }}>Titular: Divisas Ecuador S.A.</Text>
                <View style={{ height: 6 }} />
                <Text style={{ fontWeight: "700", color: COLORS.slate900 }}>🏦 Banco Guayaquil (Alternativo)</Text>
                <Text style={{ color: COLORS.slate600, fontSize: 13 }}>Cta Corriente: <Text style={{ fontWeight: "700" }}>1100987654</Text></Text>
              </View>
            ) : (
              <View style={{ backgroundColor: COLORS.white, padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: COLORS.slate200 }}>
                <Text style={{ fontWeight: "700", color: COLORS.slate900 }}>🏦 BCP - Banco de Crédito del Perú</Text>
                <Text style={{ color: COLORS.slate600, fontSize: 13 }}>Cta Corriente PEN: <Text style={{ fontWeight: "700" }}>191-98765432-0-12</Text></Text>
                <Text style={{ color: COLORS.slate600, fontSize: 13 }}>CCI: <Text style={{ fontWeight: "700" }}>00219100123456789012</Text></Text>
                <Text style={{ color: COLORS.slate600, fontSize: 13 }}>Titular: Divisas Perú S.A.C.</Text>
              </View>
            )}

            <View style={{ backgroundColor: "#FEF3C7", padding: 8, borderRadius: 6, marginBottom: 8 }}>
              <Text style={{ color: "#92400E", fontSize: 12, fontWeight: "700" }}>
                ⚠️ MUY IMPORTANTE: En el concepto / motivo de la transferencia coloca obligatoriamente el código:
              </Text>
              <Text style={{ color: "#B45309", fontSize: 16, fontWeight: "800", textAlign: "center", marginTop: 2 }}>
                {transfer.reference}
              </Text>
            </View>

            <Button title="Registrar mi transferencia" onPress={() => { setBankName(transfer.sendCurrency === "USD" ? "Banco Pichincha" : "BCP"); setPayOpen(true); }} />
          </Card>
        )}

        {transfer.paymentMethod === "CASH" && (transfer.status === "CONFIRMED" || transfer.status === "AWAITING_PAYMENT") && (
          <Card>
            <Text style={{ fontWeight: "700", color: COLORS.slate900, marginBottom: 4 }}>
              Paga en efectivo
            </Text>
            <Text style={{ color: COLORS.slate600, fontSize: 13 }}>
              Acércate a la oficina con tu documento para entregar el efectivo. Se creará un código de retiro para el beneficiario.
            </Text>
          </Card>
        )}

        <Card>
          <Text style={{ fontWeight: "700", color: COLORS.slate900, marginBottom: 8 }}>
            Seguimiento
          </Text>
          {events.length === 0 ? (
            <Text style={{ color: COLORS.slate400 }}>Sin eventos registrados.</Text>
          ) : (
            events.map((e, idx) => (
              <View key={e.id} style={{ flexDirection: "row", marginBottom: 10 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: STATUS_COLORS[e.toStatus as keyof typeof STATUS_COLORS] ?? COLORS.primary,
                    marginTop: 5,
                    marginRight: 10,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.slate900, fontWeight: "600" }}>
                    {STATUS_LABELS[e.toStatus as keyof typeof STATUS_LABELS] ?? e.toStatus}
                  </Text>
                  <Text style={{ color: COLORS.slate400, fontSize: 12 }}>
                    {new Date(e.createdAt).toLocaleString()}
                    {e.note ? ` — ${e.note}` : ""}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      <Modal visible={payOpen} transparent animationType="slide">
        <Pressable style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => setPayOpen(false)}>
          <View style={{ backgroundColor: COLORS.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
            <Text style={{ fontWeight: "800", fontSize: 18, marginBottom: 12 }}>
              Registrar pago — {fmtMoney(transfer.sendAmount, transfer.sendCurrency)}
            </Text>
            {payError && <Alert>{payError}</Alert>}
            <Input label="Banco de origen" value={bankName} onChangeText={setBankName} placeholder="Banco Pichincha, etc." />
            <Input label="Referencia (opcional)" value={transactionRef} onChangeText={setTransactionRef} />
            <Button title="Registrar pago" onPress={registerPayment} loading={paying} />
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

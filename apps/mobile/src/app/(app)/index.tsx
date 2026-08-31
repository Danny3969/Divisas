import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Badge, Button, Card, COLORS, Screen, Spinner } from "@/components/ui";
import { get } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtMoney, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import type { Customer, Transfer } from "@/lib/types";

export default function HomeScreen() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!hydrated) return;
    try {
      const [me, mine] = await Promise.all([
        get<Customer>("/customers/me"),
        get<Transfer[]>("/transfers/mine"),
      ]);
      setCustomer(me);
      setTransfers(mine);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [hydrated]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const firstName = (customer?.fullName ?? user?.fullName ?? "Operador").split(" ")[0];
  const isOperator = user?.role === "ADMIN" || user?.role === "CASHIER" || user?.role === "SUPERVISOR";
  const kycOk = isOperator || customer?.kycStatus === "APPROVED";

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 26, fontWeight: "900", color: COLORS.slate900 }}>
            Hola {firstName} 👋
          </Text>
          <Text style={{ color: "#475569", fontSize: 13, fontWeight: "600" }}>
            {isOperator ? `VALEX · Consola de ${user?.role === "ADMIN" ? "Administración" : "Ventanilla / Caja"}` : "VALEX · Envíos Ecuador ↔ Perú"}
          </Text>
        </View>
        <View style={{ backgroundColor: "#475569", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10 }}>
          <Text style={{ color: "#00E5FF", fontWeight: "900", fontSize: 13, letterSpacing: 1 }}>
            {isOperator ? (user?.role === "ADMIN" ? "ADMIN" : "CAJERO") : "VALEX"}
          </Text>
        </View>
      </View>

      {!isOperator && customer && !kycOk && (
        <Card style={{ backgroundColor: COLORS.warning + "14", borderColor: COLORS.warning }}>
          <Text style={{ color: COLORS.warning, fontWeight: "700" }}>
            Tu cuenta está en revisión (KYC {customer.kycStatus}).
          </Text>
          <Text style={{ color: COLORS.warning }}>
            Podrás enviar dinero cuando Compliance la apruebe.
          </Text>
        </Card>
      )}

      {isOperator ? (
        <Card style={{ backgroundColor: "#0f172a", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <Text style={{ color: "#00E5FF", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Operaciones de Ventanilla Móvil
          </Text>
          <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "900", marginBottom: 12 }}>
            Emisión y Liquidación Inmediata
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                title="💸 + Emitir VALEX"
                onPress={() => router.push("/send")}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="📥 Ver Giros"
                variant="secondary"
                onPress={() => router.push("/operations")}
              />
            </View>
          </View>
        </Card>
      ) : (
        <Card>
          <Button
            title="Enviar dinero"
            onPress={() => router.push("/send")}
            disabled={!kycOk}
          />
          {!kycOk && (
            <Text style={{ color: COLORS.slate400, fontSize: 12, textAlign: "center", marginTop: 8 }}>
              Requiere KYC aprobado
            </Text>
          )}
        </Card>
      )}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.slate900 }}>
          Últimas operaciones
        </Text>
        <Text
          onPress={() => router.push("/operations")}
          style={{ color: COLORS.primary, fontWeight: "600", fontSize: 13 }}
        >
          Ver todas
        </Text>
      </View>

      {loading ? (
        <Spinner />
      ) : transfers.length === 0 ? (
        <Text style={{ color: COLORS.slate400, textAlign: "center", marginTop: 24 }}>
          Todavía no tienes operaciones.
        </Text>
      ) : (
        transfers.slice(0, 5).map((t) => (
          <Pressable key={t.id} onPress={() => router.push(`/operation/${t.id}`)}>
            <Card style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: COLORS.slate900 }}>{t.reference}</Text>
                <Text style={{ color: COLORS.slate600, fontSize: 13 }}>
                  {fmtMoney(t.sendAmount, t.sendCurrency)} → {fmtMoney(t.receiveAmount, t.receiveCurrency)}
                </Text>
              </View>
              <Badge text={STATUS_LABELS[t.status]} color={STATUS_COLORS[t.status]} />
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

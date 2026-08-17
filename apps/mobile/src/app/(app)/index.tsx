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

  const firstName = (customer?.fullName ?? user?.fullName ?? "").split(" ")[0];
  const kycOk = customer?.kycStatus === "APPROVED";

  return (
    <Screen>
      <Text style={{ fontSize: 26, fontWeight: "800", color: COLORS.slate900 }}>
        Hola {firstName}
      </Text>
      <Text style={{ color: COLORS.slate600, marginBottom: 16 }}>
        Envía dinero Ecuador ↔ Perú
      </Text>

      {customer && !kycOk && (
        <Card style={{ backgroundColor: COLORS.warning + "14", borderColor: COLORS.warning }}>
          <Text style={{ color: COLORS.warning, fontWeight: "700" }}>
            Tu cuenta está en revisión (KYC {customer.kycStatus}).
          </Text>
          <Text style={{ color: COLORS.warning }}>
            Podrás enviar dinero cuando Compliance la apruebe.
          </Text>
        </Card>
      )}

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

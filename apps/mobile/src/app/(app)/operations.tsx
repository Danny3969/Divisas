import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Badge, Card, COLORS, Screen, Spinner } from "@/components/ui";
import { get } from "@/lib/api";
import { fmtMoney, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import type { Transfer } from "@/lib/types";

export default function OperationsScreen() {
  const router = useRouter();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      get<Transfer[]>("/transfers/mine")
        .then((t) => {
          if (mounted) setTransfers(t);
        })
        .catch(() => undefined)
        .finally(() => {
          if (mounted) setLoading(false);
        });
      return () => {
        mounted = false;
      };
    }, []),
  );

  return (
    <Screen>
      <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.slate900, marginBottom: 12 }}>
        Operaciones
      </Text>
      {loading ? (
        <Spinner />
      ) : transfers.length === 0 ? (
        <Text style={{ color: COLORS.slate400, textAlign: "center", marginTop: 24 }}>
          No tienes operaciones todavía.
        </Text>
      ) : (
        transfers.map((t) => (
          <Pressable key={t.id} onPress={() => router.push(`/operation/${t.id}`)}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", color: COLORS.slate900 }}>{t.reference}</Text>
                  <Text style={{ color: COLORS.slate600, fontSize: 13 }}>
                    {t.corridor?.fromCountry.code} → {t.corridor?.toCountry.code}
                  </Text>
                  <Text style={{ color: COLORS.slate600, fontSize: 13 }}>
                    {fmtMoney(t.sendAmount, t.sendCurrency)} → {fmtMoney(t.receiveAmount, t.receiveCurrency)}
                  </Text>
                </View>
                <Badge text={STATUS_LABELS[t.status]} color={STATUS_COLORS[t.status]} />
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

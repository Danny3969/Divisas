import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Alert, Badge, Button, Card, COLORS, Screen, Spinner } from "@/components/ui";
import { get } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/format";
import type { Customer } from "@/lib/types";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);

  const load = useCallback(() => {
    get<Customer>("/customers/me")
      .then(setCustomer)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.slate900, marginBottom: 12 }}>
        Perfil
      </Text>
      <Card>
        <Text style={{ fontWeight: "800", fontSize: 18, color: COLORS.slate900 }}>
          {customer?.fullName ?? user?.fullName}
        </Text>
        <Text style={{ color: COLORS.slate600, marginTop: 4 }}>{user?.email}</Text>
        <View style={{ marginTop: 8, flexDirection: "row", gap: 8 }}>
          <Badge text={ROLE_LABELS[user?.role ?? "CUSTOMER"]} color={COLORS.primary} />
          {customer && (
            <Badge
              text={`KYC ${customer.kycStatus}`}
              color={customer.kycStatus === "APPROVED" ? COLORS.success : COLORS.warning}
            />
          )}
        </View>
        {customer && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: COLORS.slate600 }}>
              {customer.documentType} {customer.documentNumber}
            </Text>
            <Text style={{ color: COLORS.slate600 }}>
              {customer.phone ? `Tel: ${customer.phone}` : ""}
            </Text>
          </View>
        )}
      </Card>
      <Card style={{ backgroundColor: "#F8FAFC", borderColor: "#CBD5E1", marginVertical: 12 }}>
        <Text style={{ fontWeight: "800", fontSize: 16, color: COLORS.slate900, marginBottom: 4 }}>
          🔐 Seguridad y Biometría
        </Text>
        <Text style={{ color: COLORS.slate600, fontSize: 13, marginBottom: 8 }}>
          Acceso rápido a tu cuenta VALEX mediante Huella Dactilar o Reconocimiento Facial.
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#334155" }}>
            Desbloqueo Biométrico
          </Text>
          <Badge text="HABILITADO" color={COLORS.success} />
        </View>
      </Card>

      <Button
        title="Cerrar sesión"
        variant="danger"
        onPress={async () => {
          await logout();
          router.replace("/login");
        }}
      />
      {!customer && !user && <Spinner />}
    </Screen>
  );
}

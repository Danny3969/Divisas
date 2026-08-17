import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Alert, Button, Card, COLORS, Input, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function LoginScreen() {
  const { login, token, hydrated } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hydrated && token) router.replace("/");
  }, [hydrated, token, router]);

  const submit = async () => {
    if (!email || !password) return setError("Ingresa tu correo y contraseña.");
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={{ justifyContent: "center" }}>
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 32, fontWeight: "800", color: COLORS.primary }}>
          Divisas
        </Text>
        <Text style={{ color: COLORS.slate600, fontSize: 15 }}>
          Envía dinero entre Ecuador y Perú
        </Text>
      </View>
      <Card>
        {error && <Alert>{error}</Alert>}
        <Input
          label="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="tucorreo@ejemplo.com"
        />
        <Input
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />
        <Button title="Iniciar sesión" onPress={submit} loading={loading} />
        <Text
          onPress={() => router.push("/register")}
          style={{
            textAlign: "center",
            marginTop: 16,
            color: COLORS.primary,
            fontWeight: "600",
          }}
        >
          ¿No tienes cuenta? Regístrate
        </Text>
      </Card>
    </Screen>
  );
}

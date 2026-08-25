import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
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
    <Screen style={{ justifyContent: "center", backgroundColor: "#475569" }}>
      <View style={{ alignItems: "center", marginBottom: 24 }}>
        <Image
          source={require("../../assets/images/splash-icon.png")}
          style={{ width: 84, height: 84, resizeMode: "contain", marginBottom: 12, borderRadius: 20 }}
        />
        <Text style={{ fontSize: 32, fontWeight: "900", color: "#FFFFFF", letterSpacing: 2 }}>
          VALEX
        </Text>
        <Text style={{ color: "#00E5FF", fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>
          Cambio de Divisas & Giros
        </Text>
      </View>
      <Card style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20 }}>
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
        <Button title="Ingresar a VALEX" onPress={submit} loading={loading} />
        <Text
          onPress={() => router.push("/register")}
          style={{
            textAlign: "center",
            marginTop: 16,
            color: "#475569",
            fontWeight: "700",
          }}
        >
          ¿No tienes cuenta? <Text style={{ color: "#0284c7" }}>Regístrate</Text>
        </Text>
      </Card>
    </Screen>
  );
}

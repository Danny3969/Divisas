import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import { Alert, Button, Card, COLORS, Input, Screen } from "@/components/ui";
import {
  getSavedBiometricCredentials,
  isBiometricsSaved,
  setBiometricsSaved,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginScreen() {
  const { login, token, hydrated } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false);
  const [hasSavedBio, setHasSavedBio] = useState(false);
  const [enableBiometricsCheck, setEnableBiometricsCheck] = useState(true);

  useEffect(() => {
    if (hydrated && token) router.replace("/");
  }, [hydrated, token, router]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const saved = await isBiometricsSaved();
        const creds = await getSavedBiometricCredentials();

        if (!mounted) return;
        setHasBiometrics(compatible);
        setIsBiometricEnrolled(enrolled);
        setHasSavedBio(saved && !!creds);

        if (creds?.email) {
          setEmail(creds.email);
        }

        // Auto trigger biometrics if enabled and credentials saved
        if (compatible && enrolled && saved && creds) {
          triggerBiometricAuth(creds.email, creds.pass);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const triggerBiometricAuth = async (bioEmail?: string, bioPass?: string) => {
    const e = bioEmail || email;
    const p = bioPass || password;

    try {
      const creds = bioEmail && bioPass ? { email: bioEmail, pass: bioPass } : await getSavedBiometricCredentials();
      if (!creds && (!e || !p)) {
        return;
      }

      const targetEmail = creds?.email || e;
      const targetPass = creds?.pass || p;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Desbloquear VALEX con Huella / Face ID",
        fallbackLabel: "Usar contraseña",
        cancelLabel: "Cancelar",
        disableDeviceFallback: false,
      });

      if (result.success) {
        setLoading(true);
        setError(null);
        await login(targetEmail, targetPass);
        router.replace("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en autenticación biométrica");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!email || !password) return setError("Ingresa tu correo y contraseña.");
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      if (hasBiometrics && isBiometricEnrolled && enableBiometricsCheck) {
        await setBiometricsSaved(true, email, password);
      }
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={{ justifyContent: "center", backgroundColor: "#0f172a" }}>
      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <Image
          source={require("../../assets/images/splash-icon.png")}
          style={{ width: 84, height: 84, resizeMode: "contain", marginBottom: 12, borderRadius: 20 }}
        />
        <Text style={{ fontSize: 32, fontWeight: "900", color: "#FFFFFF", letterSpacing: 2 }}>
          VALEX
        </Text>
        <Text style={{ color: "#00E5FF", fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
          Plataforma de Envíos & Ventanilla
        </Text>
      </View>

      <Card style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20 }}>
        {error && <Alert>{error}</Alert>}

        {hasSavedBio && (
          <View style={{ marginBottom: 16 }}>
            <Button
              title="👆 Desbloquear con Huella / Face ID"
              onPress={() => triggerBiometricAuth()}
              loading={loading}
            />
            <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: "#E2E8F0" }} />
              <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "700", marginHorizontal: 8 }}>
                O INGRESA MANUALMENTE
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: "#E2E8F0" }} />
            </View>
          </View>
        )}

        <Input
          label="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="tucorreo@valex.com"
        />
        <Input
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />

        {hasBiometrics && isBiometricEnrolled && (
          <Pressable
            onPress={() => setEnableBiometricsCheck(!enableBiometricsCheck)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 10 }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: enableBiometricsCheck ? "#0284C7" : "#CBD5E1",
                backgroundColor: enableBiometricsCheck ? "#0284C7" : "#FFFFFF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {enableBiometricsCheck && <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "900" }}>✓</Text>}
            </View>
            <Text style={{ color: "#334155", fontSize: 13, fontWeight: "600" }}>
              Recordar con Huella / Reconocimiento Facial
            </Text>
          </Pressable>
        )}

        <Button title="Ingresar a VALEX" onPress={submit} loading={loading} />

        <Text
          onPress={() => router.push("/register")}
          style={{
            textAlign: "center",
            marginTop: 16,
            color: "#475569",
            fontWeight: "700",
            fontSize: 13,
          }}
        >
          ¿No tienes cuenta? <Text style={{ color: "#0284c7" }}>Regístrate</Text>
        </Text>
      </Card>
    </Screen>
  );
}

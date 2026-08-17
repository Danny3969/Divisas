import { useEffect, useState } from "react";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import { Alert, Button, Card, COLORS, Input, Screen, Select } from "@/components/ui";
import { get, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Country } from "@/lib/types";

const DOC_TYPES = [
  { label: "Cédula (EC)", value: "CEDULA" },
  { label: "RUC (empresa)", value: "RUC" },
  { label: "DNI (PE)", value: "DNI" },
  { label: "Pasaporte", value: "PASSPORT" },
];

export default function RegisterScreen() {
  const { register, token, hydrated } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [documentType, setDocumentType] = useState("CEDULA");
  const [documentNumber, setDocumentNumber] = useState("");
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryId, setCountryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hydrated && token) router.replace("/");
  }, [hydrated, token, router]);

  useEffect(() => {
    let mounted = true;
    get<Country[]>("/fx/countries")
      .then((cs) => {
        if (!mounted) return;
        setCountries(cs);
        setCountryId(cs.find((c) => c.code === "EC")?.id ?? cs[0]?.id ?? "");
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const submit = async () => {
    if (!fullName || !documentNumber || !email || password.length < 8) {
      return setError(
        "Completa nombre, documento, correo y una contraseña de al menos 8 caracteres.",
      );
    }
    setError(null);
    setLoading(true);
    try {
      await register({
        email,
        password,
        fullName,
        phone: phone || undefined,
        customer: { type: "PERSON", documentType, documentNumber, countryId },
      });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarte");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={{ fontSize: 24, fontWeight: "800", color: COLORS.slate900, marginBottom: 16 }}>
        Crear cuenta
      </Text>
      <Card>
        {error && <Alert>{error}</Alert>}
        <Input label="Nombre completo" value={fullName} onChangeText={setFullName} />
        <Input
          label="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          label="Contraseña (mínimo 8 caracteres)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Input label="Teléfono (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Select
          label="Tipo de documento"
          value={documentType}
          options={DOC_TYPES}
          onChange={setDocumentType}
        />
        <Input label="Número de documento" value={documentNumber} onChangeText={setDocumentNumber} />
        <Select
          label="País de residencia"
          value={countryId}
          options={countries.map((c) => ({ label: c.name, value: c.id }))}
          onChange={setCountryId}
        />
        <Button title="Registrarme" onPress={submit} loading={loading} />
        <Text
          onPress={() => router.back()}
          style={{ textAlign: "center", marginTop: 16, color: COLORS.primary, fontWeight: "600" }}
        >
          Ya tengo cuenta — iniciar sesión
        </Text>
      </Card>
    </Screen>
  );
}

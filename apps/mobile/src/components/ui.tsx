import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import { useState, type ReactNode } from "react";

export const COLORS = {
  primary: "#2563eb",
  primarySoft: "#eff6ff",
  danger: "#dc2626",
  success: "#059669",
  warning: "#d97706",
  slate900: "#0f172a",
  slate600: "#475569",
  slate400: "#94a3b8",
  slate200: "#e2e8f0",
  slate50: "#f8fafc",
  white: "#ffffff",
};

export function Screen({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewProps["style"];
}) {
  return (
    <View
      style={[
        { flex: 1, backgroundColor: COLORS.slate50, padding: 16 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewProps["style"];
}) {
  return (
    <View
      style={[
        {
          backgroundColor: COLORS.white,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: COLORS.slate200,
          padding: 16,
          marginBottom: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const bg =
    variant === "primary"
      ? COLORS.primary
      : variant === "danger"
        ? COLORS.danger
        : COLORS.slate200;
  const color =
    variant === "primary" || variant === "danger"
      ? COLORS.white
      : COLORS.slate900;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 10,
          alignItems: "center",
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={{ color, fontWeight: "700", fontSize: 16 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Input({
  label,
  error,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? (
        <Text style={{ color: COLORS.slate600, fontWeight: "600", marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={COLORS.slate400}
        {...props}
        style={[
          {
            borderWidth: 1,
            borderColor: error ? COLORS.danger : COLORS.slate200,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 12,
            fontSize: 16,
            color: COLORS.slate900,
            backgroundColor: COLORS.white,
          },
          props.style,
        ]}
      />
      {error ? (
        <Text style={{ color: COLORS.danger, fontSize: 12, marginTop: 4 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: COLORS.slate600, fontWeight: "600", marginBottom: 6 }}>
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          borderWidth: 1,
          borderColor: COLORS.slate200,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 12,
          backgroundColor: COLORS.white,
        }}
      >
        <Text style={{ fontSize: 16, color: COLORS.slate900 }}>
          {selected?.label ?? "Seleccionar…"}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide">
        <Pressable
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setOpen(false)}
        >
          <View style={{ backgroundColor: COLORS.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
            <Text style={{ fontWeight: "700", fontSize: 18, marginBottom: 12 }}>
              {label}
            </Text>
            {options.map((o) => (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={{
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.slate200,
                  backgroundColor: o.value === value ? COLORS.primarySoft : COLORS.white,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: o.value === value ? "700" : "400",
                    color: o.value === value ? COLORS.primary : COLORS.slate900,
                  }}
                >
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function Badge({ text, color }: { text: string; color?: string }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: (color ?? COLORS.slate200) + "22",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ color: color ?? COLORS.slate600, fontWeight: "700", fontSize: 12 }}>
        {text}
      </Text>
    </View>
  );
}

export function Alert({
  children,
  kind = "error",
}: {
  children: ReactNode;
  kind?: "error" | "info" | "success";
}) {
  const color =
    kind === "error" ? COLORS.danger : kind === "success" ? COLORS.success : COLORS.primary;
  return (
    <View
      style={{
        backgroundColor: color + "14",
        borderColor: color,
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <Text style={{ color, fontSize: 14 }}>{children}</Text>
    </View>
  );
}

export function Spinner() {
  return (
    <View style={{ paddingVertical: 40, alignItems: "center" }}>
      <ActivityIndicator color={COLORS.primary} />
    </View>
  );
}

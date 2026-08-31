import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "./types";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://solved-loud-rating-belly.trycloudflare.com/api";

export const TOKEN_KEY = "valex_token";
export const USER_KEY = "valex_user";
export const BIOMETRICS_ENABLED_KEY = "valex_biometrics_enabled";
export const SAVED_EMAIL_KEY = "valex_saved_email";
export const SAVED_PASS_KEY = "valex_saved_pass";

export async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function setSession(token: string, user: AuthUser) {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export async function clearSession() {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

export async function isBiometricsSaved(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(BIOMETRICS_ENABLED_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

export async function setBiometricsSaved(enabled: boolean, email?: string, pass?: string) {
  try {
    await AsyncStorage.setItem(BIOMETRICS_ENABLED_KEY, enabled ? "true" : "false");
    if (enabled && email && pass) {
      await AsyncStorage.setItem(SAVED_EMAIL_KEY, email);
      await AsyncStorage.setItem(SAVED_PASS_KEY, pass);
    } else if (!enabled) {
      await AsyncStorage.removeItem(SAVED_EMAIL_KEY);
      await AsyncStorage.removeItem(SAVED_PASS_KEY);
    }
  } catch {
    // ignore
  }
}

export async function getSavedBiometricCredentials(): Promise<{ email: string; pass: string } | null> {
  try {
    const email = await AsyncStorage.getItem(SAVED_EMAIL_KEY);
    const pass = await AsyncStorage.getItem(SAVED_PASS_KEY);
    if (email && pass) return { email, pass };
    return null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function handle<T>(res: Response): Promise<T> {
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "message" in data
        ? Array.isArray((data as { message: unknown }).message)
          ? (data as { message: string[] }).message.join(", ")
          : String((data as { message: unknown }).message)
        : `Error ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { ...(await authHeaders()) },
  });
  return handle<T>(res);
}

export async function post<T>(
  path: string,
  body: unknown,
  auth = true,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? await authHeaders() : {}),
    },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

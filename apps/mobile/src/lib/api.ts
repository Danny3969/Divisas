import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "./types";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://solved-loud-rating-belly.trycloudflare.com/api";

export const TOKEN_KEY = "valex_token";
export const USER_KEY = "valex_user";

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

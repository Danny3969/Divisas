"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { post } from "./api";
import {
  clearSession,
  getSessionUser,
  getToken,
  setSession,
} from "./api";
import type { AuthUser } from "./types";

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setToken(getToken());
    setUser(getSessionUser());
    setHydrated(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await post<{ accessToken: string; user: AuthUser }>(
      "/auth/login",
      { email, password },
      false,
    );
    setSession(res.accessToken, res.user);
    setToken(res.accessToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, hydrated, login, logout }),
    [user, token, hydrated, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { get } from "./api";
import type { CashAccount, CashSession, Transfer } from "./types";

export function useCashAccounts() {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function run() {
      try {
        const data = await get<CashAccount[]>("/cash/accounts");
        if (!ignore) setAccounts(data);
        if (!ignore) setError(null);
      } catch (err) {
        if (!ignore)
          setError(err instanceof Error ? err.message : "Error al cargar cajas");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await get<CashAccount[]>("/cash/accounts");
      setAccounts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar cajas");
    }
  }, []);

  return { accounts, loading, error, refresh };
}

export function useOpenSession(cashAccountId: string | null) {
  const [session, setSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!cashAccountId) {
        if (!ignore) setSession(null);
        return;
      }
      try {
        const data = await get<CashSession | null>(
          `/cash/sessions/open/${cashAccountId}`,
        );
        if (!ignore) setSession(data);
      } catch {
        if (!ignore) setSession(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, [cashAccountId]);

  const refresh = useCallback(async () => {
    if (!cashAccountId) {
      setSession(null);
      return;
    }
    try {
      const data = await get<CashSession | null>(
        `/cash/sessions/open/${cashAccountId}`,
      );
      setSession(data);
    } catch {
      setSession(null);
    }
  }, [cashAccountId]);

  return { session, loading, refresh };
}

export function useTransfers(search?: string) {
  const [items, setItems] = useState<Transfer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function run() {
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (search) params.set("search", search);
        const res = await get<{ items: Transfer[]; total: number }>(
          `/transfers?${params.toString()}`,
        );
        if (!ignore) setItems(res.items);
        if (!ignore) setTotal(res.total);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, [search]);

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (search) params.set("search", search);
      const res = await get<{ items: Transfer[]; total: number }>(
        `/transfers?${params.toString()}`,
      );
      setItems(res.items);
      setTotal(res.total);
    } catch {
      /* noop */
    }
  }, [search]);

  return { items, total, loading, refresh };
}

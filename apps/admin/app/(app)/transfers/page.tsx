"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Input, Select, Spinner } from "@/components/ui";
import { get } from "@/lib/api";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  fmtDate,
  fmtMoney,
} from "@/lib/format";
import type { ListResponse, Transfer } from "@/lib/types";

export default function TransfersPage() {
  const [data, setData] = useState<ListResponse<Transfer> | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (query) params.set("search", query);
      if (status) params.set("status", status);
      setData(
        await get<ListResponse<Transfer>>(`/transfers?${params.toString()}`),
      );
    } finally {
      setLoading(false);
    }
  }, [query, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Operaciones</h1>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Buscar"
            placeholder="Ref, remitente o beneficiario"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select
            label="Estado"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            onClick={() => {
              setQuery(search);
              setPage(1);
            }}
          >
            Filtrar
          </Button>
        </div>
      </Card>

      {loading && !data ? (
        <Spinner />
      ) : (
        <Card
          title={`${data?.total ?? 0} resultados`}
          action={
            <div className="text-sm text-slate-500">
              Página {page}
            </div>
          }
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="py-2">Referencia</th>
                <th className="py-2">Fecha</th>
                <th className="py-2">Remitente</th>
                <th className="py-2">Beneficiario</th>
                <th className="py-2">Monto</th>
                <th className="py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((t) => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2">
                    <Link
                      href={`/transfers/detail?id=${t.id}`}
                      className="font-mono font-semibold text-blue-700 hover:underline"
                    >
                      {t.reference}
                    </Link>
                  </td>
                  <td className="py-2 text-slate-500">{fmtDate(t.createdAt)}</td>
                  <td className="py-2">{t.sender.fullName}</td>
                  <td className="py-2">{t.beneficiary.fullName}</td>
                  <td className="py-2 font-medium">
                    {fmtMoney(t.sendAmount, t.sendCurrency)} →{" "}
                    {fmtMoney(t.receiveAmount, t.receiveCurrency)}
                  </td>
                  <td className="py-2">
                    <Badge className={STATUS_COLORS[t.status]}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-between">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              disabled={!data || page * 25 >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

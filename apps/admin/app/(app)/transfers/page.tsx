"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Operaciones y Giros</h1>
        <Button
          variant="primary"
          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
          onClick={() => router.push("/transfer/new")}
        >
          ➕ Nueva Transferencia
        </Button>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Buscar Operación"
            placeholder="Ref, código, remitente o beneficiario"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72"
          />
          <Select
            label="Estado"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los estados</option>
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
            <div className="text-xs text-slate-500 font-medium">
              💡 Haz clic o doble clic en cualquier fila para abrir el detalle
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 bg-slate-50">
                  <th className="py-2.5 px-3">Referencia</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Remitente</th>
                  <th className="py-2.5 px-3">Beneficiario</th>
                  <th className="py-2.5 px-3">Monto Enviado → Neto</th>
                  <th className="py-2.5 px-3">Código VALEX</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/transfers/detail?id=${t.id}`)}
                    onDoubleClick={() => router.push(`/transfers/detail?id=${t.id}`)}
                    className="border-b border-slate-100 hover:bg-cyan-50/60 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-blue-700 hover:underline">
                        {t.reference}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-500">{fmtDate(t.createdAt)}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{t.sender.fullName}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{t.beneficiary.fullName}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {fmtMoney(t.sendAmount, t.sendCurrency)}{" "}
                      <span className="text-slate-400 font-normal">→</span>{" "}
                      <span className="text-emerald-800">{fmtMoney(t.receiveAmount, t.receiveCurrency)}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                        {t.withdrawalCode ? (t.withdrawalCode.split("-").length === 3 ? `${t.withdrawalCode.split("-")[0]}-${t.withdrawalCode.split("-")[1]}-••••` : `${t.withdrawalCode.slice(0, 4)}••••`) : "—"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge className={STATUS_COLORS[t.status]}>
                        {STATUS_LABELS[t.status] ?? t.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Button
                        variant="secondary"
                        className="text-xs font-bold py-1 px-2.5 text-blue-700 hover:bg-blue-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/transfers/detail?id=${t.id}`);
                        }}
                      >
                        Ver Detalle ➔
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-xs text-slate-500 font-medium">Página {page}</span>
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

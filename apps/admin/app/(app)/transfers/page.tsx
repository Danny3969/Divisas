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

function maskValexCode(code?: string) {
  if (!code) return "—";
  const parts = code.split("-");
  if (parts.length === 3) {
    return `${parts[0]}-${parts[1]}-••••`;
  }
  return code.slice(0, Math.ceil(code.length / 2)) + "••••";
}

export default function TransfersPage() {
  const router = useRouter();
  const [data, setData] = useState<ListResponse<Transfer> | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [directionFilter, setDirectionFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (query) params.set("search", query);
      if (status) params.set("status", status);
      const res = await get<ListResponse<Transfer>>(`/transfers?${params.toString()}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [query, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Client-side filtering by direction if selected
  const filteredItems = (data?.items ?? []).filter((t) => {
    if (directionFilter === "EC_TO_PE") return t.corridor?.direction === "EC_TO_PE";
    if (directionFilter === "PE_TO_EC") return t.corridor?.direction === "PE_TO_EC";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#475569] text-white p-4 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <span>📤</span> VALEX Realizados (Giros Enviados / Salientes)
          </h1>
          <p className="text-xs text-[#00E5FF] font-semibold">
            Registro de operaciones emitidas en cajas de origen (Ecuador 🇪🇨 y Perú 🇵🇪)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="text-xs font-bold text-emerald-950 bg-emerald-300 hover:bg-emerald-200"
            onClick={() => router.push("/payout")}
          >
            📥 Ir a VALEX Recibidos (Retiro) ➔
          </Button>
          <Button
            variant="primary"
            className="bg-[#00E5FF] hover:bg-cyan-300 text-slate-900 font-extrabold text-xs"
            onClick={() => router.push("/transfer/new")}
          >
            ➕ Emitir Nuevo VALEX
          </Button>
        </div>
      </div>

      {/* TABS FOR DIRECTION */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setDirectionFilter("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            directionFilter === "ALL"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          🌐 Todos los Realizados ({data?.total ?? 0})
        </button>
        <button
          onClick={() => setDirectionFilter("EC_TO_PE")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            directionFilter === "EC_TO_PE"
              ? "bg-blue-700 text-white shadow-xs"
              : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200"
          }`}
        >
          🇪🇨 Caja Ecuador → 🇵🇪 Perú
        </button>
        <button
          onClick={() => setDirectionFilter("PE_TO_EC")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            directionFilter === "PE_TO_EC"
              ? "bg-amber-700 text-white shadow-xs"
              : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
          }`}
        >
          🇵🇪 Caja Perú → 🇪🇨 Ecuador
        </button>
      </div>

      {/* SEARCH AND FILTERS */}
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Buscar en VALEX Realizados"
            placeholder="Ref, código, remitente o beneficiario"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72"
          />
          <Select
            label="Estado del Giro"
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
          title={`${filteredItems.length} Operaciones Emitidas`}
          action={
            <div className="text-xs text-slate-500 font-medium">
              💡 Haz clic o doble clic en cualquier fila para abrir la ficha
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 bg-slate-50">
                  <th className="py-2.5 px-3">Referencia</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Caja Emisora</th>
                  <th className="py-2.5 px-3">Remitente</th>
                  <th className="py-2.5 px-3">Beneficiario</th>
                  <th className="py-2.5 px-3">Cobrado → Neto Destino</th>
                  <th className="py-2.5 px-3">Código VALEX</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((t) => (
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
                    <td className="py-2.5 px-3 text-xs font-bold text-slate-700">
                      {t.corridor?.fromCountry.code === "EC" ? "🇪🇨 Ecuador" : "🇵🇪 Perú"}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{t.sender.fullName}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{t.beneficiary.fullName}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {fmtMoney(t.sendAmount, t.sendCurrency)}{" "}
                      <span className="text-slate-400 font-normal">→</span>{" "}
                      <span className="text-emerald-800">{fmtMoney(t.receiveAmount, t.receiveCurrency)}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                        {maskValexCode(t.withdrawalCode)}
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
                        Ver Ficha ➔
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
              disabled={!data || page * 50 >= data.total}
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

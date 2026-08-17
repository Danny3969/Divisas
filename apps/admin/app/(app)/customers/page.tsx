"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  Spinner,
} from "@/components/ui";
import { get, post } from "@/lib/api";
import type { Customer, ListResponse } from "@/lib/types";

export default function CustomersPage() {
  const [data, setData] = useState<ListResponse<Customer> | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [kyc, setKyc] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (query) params.set("search", query);
      if (kyc) params.set("kycStatus", kyc);
      setData(await get<ListResponse<Customer>>(`/customers?${params}`));
    } finally {
      setLoading(false);
    }
  }, [query, kyc, page]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: string, decision: "APPROVE" | "REJECT") => {
    await post(`/customers/${id}/kyc`, { decision });
    load();
  };

  const kycBadge = (s: string) =>
    s === "APPROVED"
      ? "bg-emerald-100 text-emerald-800"
      : s === "REJECTED"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Clientes</h1>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Buscar"
            placeholder="Nombre, documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select
            label="Estado KYC"
            value={kyc}
            onChange={(e) => {
              setKyc(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="APPROVED">Aprobado</option>
            <option value="PENDING">Pendiente</option>
            <option value="REJECTED">Rechazado</option>
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
        <Card title={`${data?.total ?? 0} clientes`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="py-2">Nombre</th>
                <th className="py-2">Documento</th>
                <th className="py-2">Contacto</th>
                <th className="py-2">KYC</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2 font-medium text-slate-800">
                    {c.fullName}
                  </td>
                  <td className="py-2 text-slate-600">
                    {c.documentType} {c.documentNumber}
                  </td>
                  <td className="py-2 text-slate-500">
                    {c.email ?? c.phone ?? "—"}
                  </td>
                  <td className="py-2">
                    <Badge className={kycBadge(c.kycStatus)}>
                      {c.kycStatus}
                    </Badge>
                  </td>
                  <td className="py-2">
                    {c.kycStatus === "PENDING" && (
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          onClick={() => approve(c.id, "APPROVE")}
                        >
                          Aprobar
                        </Button>
                        <Button
                          variant="danger"
                          className="px-2 py-1 text-xs"
                          onClick={() => approve(c.id, "REJECT")}
                        >
                          Rechazar
                        </Button>
                      </div>
                    )}
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

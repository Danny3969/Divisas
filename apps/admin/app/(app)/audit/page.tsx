"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Select, Spinner } from "@/components/ui";
import { get } from "@/lib/api";
import { fmtDate } from "@/lib/format";

interface AuditLog {
  id: string;
  entity: string;
  entityId?: string;
  action: string;
  metadata?: unknown;
  createdAt: string;
  actor: { fullName?: string; email?: string };
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [entity, setEntity] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (entity) params.set("entity", entity);
      setLogs(await get<AuditLog[]>(`/admin/audit?${params}`));
    } finally {
      setLoading(false);
    }
  }, [entity]);

  useEffect(() => {
    load();
  }, [load]);

  const entities = Array.from(new Set(logs.map((l) => l.entity)));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Auditoría</h1>

      <Card>
        <Select
          label="Entidad"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          className="max-w-xs"
        >
          <option value="">Todas</option>
          {entities.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
      </Card>

      {loading ? (
        <Spinner />
      ) : (
        <Card title={`${logs.length} registros`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="py-2">Fecha</th>
                <th className="py-2">Usuario</th>
                <th className="py-2">Entidad</th>
                <th className="py-2">Acción</th>
                <th className="py-2">ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-slate-50">
                  <td className="py-2 text-slate-500">{fmtDate(l.createdAt)}</td>
                  <td className="py-2">{l.actor?.fullName ?? l.actor?.email}</td>
                  <td className="py-2 font-medium text-slate-800">
                    {l.entity}
                  </td>
                  <td className="py-2">{l.action}</td>
                  <td className="py-2 font-mono text-xs text-slate-400">
                    {l.entityId ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

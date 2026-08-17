"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { STATUS_COLORS, STATUS_LABELS, fmtDate, fmtMoney } from "@/lib/format";
import { useTransfers } from "@/lib/hooks";
import type { Transfer } from "@/lib/types";

function TransferRow({ t, onClick }: { t: Transfer; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50"
    >
      <div>
        <div className="text-sm font-semibold text-slate-800">{t.reference}</div>
        <div className="text-xs text-slate-500">
          {t.sender.fullName} → {t.beneficiary.fullName}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-semibold text-slate-800">
            {fmtMoney(t.sendAmount, t.sendCurrency)} →{" "}
            {fmtMoney(t.receiveAmount, t.receiveCurrency)}
          </div>
          <div className="text-xs text-slate-400">{fmtDate(t.createdAt)}</div>
        </div>
        <Badge className={STATUS_COLORS[t.status]}>
          {STATUS_LABELS[t.status] ?? t.status}
        </Badge>
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const { items, total, loading } = useTransfers(query);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">
          Bienvenido, {user?.fullName}
        </h1>
        <Button onClick={() => router.push("/transfer/new")}>
          + Nueva transferencia
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card title="Transferencias">
          <div className="text-2xl font-bold text-slate-900">{total}</div>
        </Card>
        <Card title="Panel">
          <div className="text-sm text-slate-600">
            {loading ? "Actualizando..." : "Listo"}
          </div>
        </Card>
        <Card title="Acciones rápidas">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              onClick={() => router.push("/payout")}
            >
              Retiro
            </Button>
            <Button
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              onClick={() => router.push("/sessions")}
            >
              Caja
            </Button>
          </div>
        </Card>
      </div>

      <Card
        title="Operaciones recientes"
        action={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search);
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Buscar por ref, cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button type="submit" variant="secondary">
              Buscar
            </Button>
          </form>
        }
      >
        {items.length === 0 && !loading ? (
          <div className="py-8 text-center text-sm text-slate-400">
            No hay operaciones todavía.
          </div>
        ) : (
          items.map((t) => (
            <TransferRow
              key={t.id}
              t={t}
              onClick={() => router.push(`/transfer?id=${t.id}`)}
            />
          ))
        )}
      </Card>
    </div>
  );
}

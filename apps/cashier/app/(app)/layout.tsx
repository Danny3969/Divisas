"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/format";

const NAV = [
  { href: "/dashboard", label: "Panel" },
  { href: "/transfer/new", label: "Nueva transferencia" },
  { href: "/payout", label: "Retiro / cash-out" },
  { href: "/sessions", label: "Caja y sesiones" },
];

function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="text-lg font-bold text-blue-700">Divisas</div>
        <div className="text-xs text-slate-500">Consola de caja</div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-800">
          {user?.fullName}
        </div>
        <div className="text-xs text-slate-500">
          {user?.role ? ROLE_LABELS[user.role] : user?.role}
          {user?.officeName ? ` · ${user.officeName}` : ""}
        </div>
        <button
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="mt-2 text-xs font-medium text-red-600 hover:text-red-700"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

import { FxTicker } from "@/components/fx-ticker";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { token, hydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  if (!hydrated || !token) return null;

  return (
    <div className="flex h-full flex-col">
      <FxTicker />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-100 p-6">{children}</main>
      </div>
    </div>
  );
}

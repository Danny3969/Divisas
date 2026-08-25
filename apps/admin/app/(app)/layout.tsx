"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/format";
import { FxTicker } from "@/components/fx-ticker";

const ADMIN_NAV = [
  { href: "/dashboard", label: "Panel General", icon: "📊" },
  { href: "/transfer/new", label: "Emitir Nuevo VALEX", icon: "💸" },
  { href: "/transfers", label: "VALEX Realizados", icon: "📤" },
  { href: "/payout", label: "VALEX Recibidos", icon: "📥" },
  { href: "/customers", label: "Clientes", icon: "👥" },
  { href: "/beneficiaries", label: "Beneficiarios", icon: "👤" },
  { href: "/cash", label: "Bóvedas & Cajas", icon: "🏧" },
  { href: "/sessions", label: "Sesiones de Caja", icon: "🕒" },
  { href: "/users", label: "Usuarios & Roles", icon: "🛡️" },
  { href: "/fx", label: "Tasas FX & Spreads", icon: "📈" },
  { href: "/fees", label: "Comisiones", icon: "🏷️" },
  { href: "/treasury", label: "Tesorería", icon: "🏦" },
  { href: "/ledger", label: "Contabilidad", icon: "📖" },
  { href: "/audit", label: "Auditoría", icon: "🔍" },
];

const CASHIER_NAV = [
  { href: "/dashboard", label: "Panel de Caja", icon: "🏠" },
  { href: "/transfer/new", label: "+ Emitir Nuevo VALEX", icon: "💸" },
  { href: "/transfers", label: "VALEX Realizados", icon: "📤" },
  { href: "/payout", label: "VALEX Recibidos", icon: "📥" },
  { href: "/sessions", label: "Caja & Sesiones", icon: "🏧" },
  { href: "/beneficiaries", label: "Beneficiarios", icon: "👥" },
  { href: "/customers", label: "Directorio Clientes", icon: "📇" },
];

function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  const isCashier = user?.role === "CASHIER";
  const isAdminOrSuper = user?.role === "ADMIN" || user?.role === "SUPERVISOR";
  const countryCode = user?.office?.country?.code ?? "";

  const countryBadge =
    countryCode === "PE"
      ? "🇵🇪 Perú (Sullana)"
      : countryCode === "EC"
        ? "🇪🇨 Ecuador (Macará)"
        : null;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Header */}
      <div className="border-b border-slate-700 px-4 py-4 bg-[#475569] text-white">
        <div className="flex items-center gap-3">
          <img
            src="/isotype_plomo.png"
            alt="VALEX"
            className="w-10 h-10 rounded-xl object-contain shadow-sm border border-slate-500/50 p-0.5"
          />
          <div>
            <div className="text-xl font-black tracking-wider text-white flex items-center gap-1">
              VALEX
            </div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-[#00E5FF]">
              {isCashier ? "Ventanilla / Caja" : "Portal Unificado"}
            </div>
          </div>
        </div>
        {countryBadge && (
          <div className="mt-2 text-[11px] font-bold text-amber-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-600 flex items-center gap-1">
            <span>Agencia:</span> {countryBadge}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {isCashier ? (
          // Cashier Menu
          <>
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Operaciones de Ventanilla
            </div>
            {CASHIER_NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-slate-100 text-slate-900 font-bold border-l-4 border-[#00E5FF]"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </>
        ) : (
          // Admin / Supervisor Menu
          <>
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Administración General
            </div>
            {ADMIN_NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-slate-100 text-slate-900 font-bold border-l-4 border-[#00E5FF]"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {isAdminOrSuper && (
              <>
                <div className="pt-3 px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-t border-slate-100 mt-2">
                  Operaciones de Caja
                </div>
                <Link
                  href="/transfer/new"
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    pathname === "/transfer/new"
                      ? "bg-emerald-50 text-emerald-800 font-bold border-l-4 border-emerald-500"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>💸</span>
                  <span>+ Nueva Transferencia</span>
                </Link>
                <Link
                  href="/payout"
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    pathname === "/payout"
                      ? "bg-emerald-50 text-emerald-800 font-bold border-l-4 border-emerald-500"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>💵</span>
                  <span>Retiro / Payout</span>
                </Link>
                <Link
                  href="/sessions"
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    pathname === "/sessions"
                      ? "bg-emerald-50 text-emerald-800 font-bold border-l-4 border-emerald-500"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>🏧</span>
                  <span>Sesiones y Arqueo</span>
                </Link>
              </>
            )}
          </>
        )}
      </nav>

      {/* APK Download Button */}
      <div className="px-3 pb-2">
        <a
          href="/downloads/VALEX.apk"
          download="VALEX.apk"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-[#475569] text-white hover:bg-slate-700 text-xs font-bold border border-slate-600 transition-all shadow-sm"
        >
          <span className="text-base">📱</span>
          <span className="text-[#00E5FF]">Descargar APK VALEX</span>
        </a>
      </div>

      {/* User info & Logout */}
      <div className="border-t border-slate-200 p-4 bg-slate-50">
        <div className="text-sm font-semibold text-slate-800">
          {user?.fullName}
        </div>
        <div className="text-xs text-slate-500">
          {user?.role ? ROLE_LABELS[user.role] : user?.role}
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


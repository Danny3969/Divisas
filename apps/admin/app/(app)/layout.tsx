"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/format";

const NAV = [
  { href: "/dashboard", label: "Panel" },
  { href: "/transfers", label: "Operaciones" },
  { href: "/customers", label: "Clientes" },
  { href: "/beneficiaries", label: "Beneficiarios" },
  { href: "/users", label: "Usuarios" },
  { href: "/fx", label: "Tasas FX" },
  { href: "/treasury", label: "Tesorería" },
  { href: "/ledger", label: "Contabilidad" },
  { href: "/cash", label: "Cajas" },
  { href: "/audit", label: "Auditoría" },
];

function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
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
              Administración
            </div>
          </div>
        </div>
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
                  ? "bg-slate-100 text-slate-900 font-bold border-l-4 border-[#00E5FF]"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
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
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-100 p-6">{children}</main>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Alert, Button, Card, Input } from "@/components/ui";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-[#475569] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <img
              src="/logo_plomo.png"
              alt="VALEX"
              className="h-20 object-contain drop-shadow-md"
            />
          </div>
          <p className="text-xs font-semibold tracking-widest text-[#00E5FF] uppercase">
            Consola de Administración & Finanzas
          </p>
        </div>

        <Card className="w-full bg-white/95 backdrop-blur shadow-2xl border-slate-300">
          <form onSubmit={onSubmit} className="space-y-4 pt-2">
            {error && <Alert>{error}</Alert>}
            <Input
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              placeholder="admin@divisas.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              className="w-full bg-[#475569] hover:bg-slate-700 text-white font-bold py-2.5 transition-all shadow-md"
              loading={loading}
            >
              Acceder a VALEX Admin
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

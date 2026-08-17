"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Select,
  Spinner,
} from "@/components/ui";
import { get, patch, post } from "@/lib/api";
import { fmtDate, ROLE_LABELS } from "@/lib/format";
import type { Office } from "@/lib/types";

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  role: string;
  officeId?: string | null;
  office?: { id: string; name: string; country: { code: string; name: string } } | null;
  active: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal crear usuario
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("CASHIER");
  const [officeId, setOfficeId] = useState("");

  // Modal reset password
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const loadData = async () => {
    try {
      const [uList, oList] = await Promise.all([
        get<UserItem[]>("/admin/users"),
        get<Office[]>("/admin/offices"),
      ]);
      setUsers(uList);
      setOffices(oList);
      if (oList.length > 0 && !officeId) setOfficeId(oList[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      await post("/admin/users", {
        email,
        password,
        fullName,
        role,
        officeId: officeId || undefined,
      });
      setSuccess(`Usuario ${fullName} (${role}) creado con éxito.`);
      setShowCreateModal(false);
      setEmail("");
      setPassword("");
      setFullName("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear usuario");
    } finally {
      setWorking(false);
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    setError(null);
    setSuccess(null);
    try {
      await patch(`/admin/users/${user.id}`, { active: !user.active });
      setSuccess(`Estado de usuario ${user.fullName} actualizado.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar estado");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId) return;
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      await post(`/admin/users/${resetUserId}/reset-password`, { newPassword });
      setSuccess("Contraseña restablecida con éxito.");
      setResetUserId(null);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al restablecer contraseña");
    } finally {
      setWorking(false);
    }
  };

  const handleResetDemoData = async () => {
    if (
      !confirm(
        "⚠️ ATENCIÓN: ¿Está seguro de eliminar TODOS los giros, transacciones y sesiones de prueba ficticias?\n\nEsta acción dejará el sistema en $0.00 preparado para el registro de operaciones reales de producción."
      )
    )
      return;

    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      const res = await post<{ message: string }>("/admin/reset-demo-data", {});
      setSuccess(res.message);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al limpiar datos de prueba");
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Gestión de Usuarios y Accesos</h1>
          <p className="text-xs text-slate-500">
            Administración de cuentas de cajeros, supervisores y administradores del sistema.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} variant="primary">
          ➕ Crear Nuevo Usuario
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      <Card
        title="👥 Usuarios del Sistema Registrados"
        action={
          <Badge className="bg-blue-100 text-blue-800">
            {users.length} Usuarios Activos
          </Badge>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                <th className="py-3">Usuario / Nombre</th>
                <th className="py-3">Correo Electrónico</th>
                <th className="py-3">Rol de Acceso</th>
                <th className="py-3">Agencia / Oficina</th>
                <th className="py-3">Estado</th>
                <th className="py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-3 font-semibold text-slate-800">{u.fullName}</td>
                  <td className="py-3 font-mono text-xs text-slate-600">{u.email}</td>
                  <td className="py-3">
                    <Badge
                      className={
                        u.role === "ADMIN"
                          ? "bg-purple-100 text-purple-800"
                          : u.role === "CASHIER"
                          ? "bg-emerald-100 text-emerald-800"
                          : u.role === "SUPERVISOR"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }
                    >
                      {ROLE_LABELS[u.role] ?? u.role}
                    </Badge>
                  </td>
                  <td className="py-3 text-xs text-slate-600">
                    {u.office
                      ? u.office.country?.code === "EC" || u.office.name.includes("Quito")
                        ? "Ecuador"
                        : u.office.country?.code === "PE" || u.office.name.includes("Lima")
                        ? "Perú"
                        : u.office.name
                      : "Todas las agencias"}
                  </td>
                  <td className="py-3">
                    <button onClick={() => handleToggleActive(u)}>
                      <Badge
                        className={
                          u.active
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-red-100 text-red-800 hover:bg-red-200"
                        }
                      >
                        {u.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </button>
                  </td>
                  <td className="py-3 text-right space-x-2">
                    <button
                      onClick={() => setResetUserId(u.id)}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      🔑 Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="🧹 Limpieza de Datos Ficticios (Preparación para Operaciones Reales)">
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            Utilice este botón si desea purgar las transacciones ficticias de prueba, cuentas de clientes de demostración y movimientos simulación, manteniendo intactas las agencias, bancos y roles para comenzar a registrar **operaciones reales de producción**.
          </p>
          <Button
            variant="secondary"
            className="border-red-500 text-red-700 hover:bg-red-50 font-bold"
            onClick={handleResetDemoData}
            loading={working}
          >
            🧹 Limpiar Datos Ficticios de Prueba
          </Button>
        </div>
      </Card>

      {/* Modal Crear Usuario */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Crear Nuevo Usuario del Sistema</h2>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <Input
                label="Nombre completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej: Laura Mendoza"
                required
              />
              <Input
                label="Correo electrónico (Login)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="laura.mendoza@divisas.com"
                required
              />
              <Input
                label="Contraseña inicial"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <Select
                label="Rol / Nivel de Acceso"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="CASHIER">Cajero / Operador de Ventanilla</option>
                <option value="SUPERVISOR">Supervisor de Agencia</option>
                <option value="ADMIN">Administrador / Superusuario</option>
                <option value="TREASURY">Tesorero / Control FX</option>
                <option value="COMPLIANCE">Oficial de Cumplimiento UAFE/SBS</option>
                <option value="AUDITOR">Auditor</option>
              </Select>
              <Select
                label="Agencia / Oficina Asignada"
                value={officeId}
                onChange={(e) => setOfficeId(e.target.value)}
              >
                <option value="">Todas las Oficinas (Global)</option>
                {offices.map((o) => {
                  const label =
                    o.country?.code === "EC" || o.name.includes("Quito")
                      ? "Ecuador"
                      : o.country?.code === "PE" || o.name.includes("Lima")
                      ? "Perú"
                      : o.name;
                  return (
                    <option key={o.id} value={o.id}>
                      {label}
                    </option>
                  );
                })}
              </Select>
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" loading={working} className="flex-1">
                  Guardar Usuario
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {resetUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Restablecer Contraseña</h2>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <Input
                label="Nueva Contraseña"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setResetUserId(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" loading={working} className="flex-1">
                  Actualizar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

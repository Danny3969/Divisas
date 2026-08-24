"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Spinner,
} from "@/components/ui";
import { get, patch, post, del, getSessionUser } from "@/lib/api";
import { fmtDate, ROLE_LABELS } from "@/lib/format";
import type { Office } from "@/lib/types";

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
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
  const currentUser = getSessionUser();

  // Modal crear / editar usuario
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "CASHIER",
    officeId: "",
    active: true,
  });

  // Modal reset password
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetUserFullName, setResetUserFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const loadData = async () => {
    try {
      const [uList, oList] = await Promise.all([
        get<UserItem[]>("/admin/users"),
        get<Office[]>("/admin/offices"),
      ]);
      setUsers(uList);
      setOffices(oList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingUserId(null);
    setUserForm({
      fullName: "",
      email: "",
      phone: "",
      password: "",
      role: "CASHIER",
      officeId: offices.length > 0 ? offices[0].id : "",
      active: true,
    });
    setShowUserModal(true);
  };

  const openEditModal = (u: UserItem) => {
    setEditingUserId(u.id);
    setUserForm({
      fullName: u.fullName,
      email: u.email,
      phone: u.phone || "",
      password: "",
      role: u.role,
      officeId: u.officeId || "",
      active: u.active,
    });
    setShowUserModal(true);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      if (editingUserId) {
        // Actualizar usuario existente
        await patch(`/admin/users/${editingUserId}`, {
          fullName: userForm.fullName,
          email: userForm.email,
          phone: userForm.phone || undefined,
          role: userForm.role,
          officeId: userForm.officeId || null,
          active: userForm.active,
        });
        setSuccess(`Usuario ${userForm.fullName} actualizado exitosamente.`);
      } else {
        // Crear nuevo usuario
        if (!userForm.password || userForm.password.length < 6) {
          throw new Error("La contraseña debe tener al menos 6 caracteres.");
        }
        await post("/admin/users", {
          fullName: userForm.fullName,
          email: userForm.email,
          phone: userForm.phone || undefined,
          password: userForm.password,
          role: userForm.role,
          officeId: userForm.officeId || undefined,
        });
        setSuccess(`Usuario ${userForm.fullName} (${userForm.role}) creado exitosamente.`);
      }
      setShowUserModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar usuario");
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteUser = async (u: UserItem) => {
    if (u.email === "admin@divisas.com") {
      alert("No se puede eliminar el usuario administrador principal del sistema.");
      return;
    }
    if (currentUser && currentUser.userId === u.id) {
      alert("No puedes eliminar tu propia cuenta en sesión activa.");
      return;
    }
    if (
      !confirm(
        `¿Estás seguro de eliminar permanentemente al usuario ${u.fullName} (${u.email})?\n\nEsta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      await del(`/admin/users/${u.id}`);
      setSuccess(`Usuario ${u.fullName} eliminado exitosamente.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar usuario");
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
      setSuccess(`Contraseña de ${resetUserFullName} restablecida con éxito.`);
      setResetUserId(null);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al restablecer contraseña");
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">👥</span>
            <h1 className="text-xl font-bold text-slate-900">Gestión de Usuarios y Accesos</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Crea, edita roles, oficinas y credenciales de cajeros, supervisores y administradores.
          </p>
        </div>
        <Button onClick={openCreateModal} variant="primary" className="font-bold shadow-sm">
          ➕ Crear Nuevo Usuario
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      <Card
        title="👥 Usuarios del Sistema Registrados"
        action={
          <Badge className="bg-blue-100 text-blue-800 font-bold">
            {users.length} Usuarios Registrados
          </Badge>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 bg-slate-50">
                <th className="py-3 px-3">Usuario / Nombre</th>
                <th className="py-3 px-3">Correo Electrónico</th>
                <th className="py-3 px-3">Rol de Acceso</th>
                <th className="py-3 px-3">Agencia / Oficina</th>
                <th className="py-3 px-3 text-center">Estado</th>
                <th className="py-3 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">{u.fullName}</div>
                    {u.phone && <div className="text-[10px] text-slate-400 font-mono">{u.phone}</div>}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-700">{u.email}</td>
                  <td className="py-3 px-3">
                    <Badge
                      className={
                        u.role === "ADMIN"
                          ? "bg-purple-100 text-purple-800 font-bold"
                          : u.role === "CASHIER"
                          ? "bg-emerald-100 text-emerald-800 font-bold"
                          : u.role === "SUPERVISOR"
                          ? "bg-amber-100 text-amber-800 font-bold"
                          : "bg-blue-100 text-blue-800 font-bold"
                      }
                    >
                      {ROLE_LABELS[u.role] ?? u.role}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-medium">
                    {u.office
                      ? u.office.country?.code === "EC" || u.office.name.includes("Quito")
                        ? "🇪🇨 Ecuador"
                        : u.office.country?.code === "PE" || u.office.name.includes("Lima")
                        ? "🇵🇪 Perú"
                        : u.office.name
                      : "🌐 Todas las agencias (Global)"}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => handleToggleActive(u)}
                      title="Clic para cambiar estado"
                      className="cursor-pointer transition-transform active:scale-95"
                    >
                      <Badge
                        className={
                          u.active
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-red-100 text-red-800 hover:bg-red-200"
                        }
                      >
                        {u.active ? "● Activo" : "○ Inactivo"}
                      </Badge>
                    </button>
                  </td>
                  <td className="py-3 px-3 text-center space-x-2">
                    <button
                      onClick={() => openEditModal(u)}
                      className="px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => {
                        setResetUserId(u.id);
                        setResetUserFullName(u.fullName);
                        setNewPassword("");
                      }}
                      className="px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded"
                    >
                      🔑 Password
                    </button>
                    {u.email !== "admin@divisas.com" && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        disabled={working}
                        className="px-2 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded"
                        title="Eliminar usuario"
                      >
                        🗑️ Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Crear / Editar Usuario */}
      <Modal
        open={showUserModal}
        onClose={() => setShowUserModal(false)}
        title={editingUserId ? "✏️ Editar Usuario del Sistema" : "➕ Crear Nuevo Usuario del Sistema"}
      >
        <form onSubmit={handleSubmitUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Nombre Completo"
              value={userForm.fullName}
              onChange={(e) => setUserForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="Ej: Laura Mendoza"
              required
            />
            <Input
              label="Correo Electrónico (Login)"
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="laura.mendoza@divisas.com"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Teléfono / Celular (Opcional)"
              value={userForm.phone}
              onChange={(e) => setUserForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Ej: +593 999 123 456"
            />
            {!editingUserId ? (
              <Input
                label="Contraseña Inicial"
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
                required
              />
            ) : (
              <Select
                label="Estado del Usuario"
                value={userForm.active ? "true" : "false"}
                onChange={(e) => setUserForm((f) => ({ ...f, active: e.target.value === "true" }))}
              >
                <option value="true">● Activo (Permite acceso)</option>
                <option value="false">○ Inactivo (Bloquear acceso)</option>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Rol / Nivel de Acceso"
              value={userForm.role}
              onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="CASHIER">Cajero / Operador de Ventanilla</option>
              <option value="SUPERVISOR">Supervisor de Agencia</option>
              <option value="ADMIN">Administrador / Superusuario</option>
              <option value="TREASURY">Tesorero / Control FX</option>
              <option value="COMPLIANCE">Oficial de Cumplimiento UAFE/SBS</option>
              <option value="AUDITOR">Auditor</option>
              <option value="CUSTOMER">Cliente / Usuario Web</option>
            </Select>

            <Select
              label="Agencia / Oficina Asignada"
              value={userForm.officeId}
              onChange={(e) => setUserForm((f) => ({ ...f, officeId: e.target.value }))}
            >
              <option value="">🌐 Todas las Oficinas (Acceso Global)</option>
              {offices.map((o) => {
                const label =
                  o.country?.code === "EC" || o.name.includes("Quito")
                    ? "🇪🇨 Ecuador"
                    : o.country?.code === "PE" || o.name.includes("Lima")
                    ? "🇵🇪 Perú"
                    : o.name;
                return (
                  <option key={o.id} value={o.id}>
                    {label}
                  </option>
                );
              })}
            </Select>
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setShowUserModal(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={working} className="flex-1 font-bold">
              {editingUserId ? "💾 Guardar Cambios" : "➕ Crear Usuario"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Reset Password */}
      <Modal
        open={!!resetUserId}
        onClose={() => setResetUserId(null)}
        title={`🔑 Restablecer Contraseña — ${resetUserFullName}`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <Input
            label="Nueva Contraseña"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            required
          />
          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setResetUserId(null)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={working} className="flex-1 font-bold">
              Actualizar Contraseña
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

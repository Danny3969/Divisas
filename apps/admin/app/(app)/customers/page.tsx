"use client";

import { useCallback, useEffect, useState } from "react";
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
import { del, get, patch, post } from "@/lib/api";
import { fmtDate, fmtPhone, normalizePhone } from "@/lib/format";
import type { Customer, ListResponse } from "@/lib/types";

interface DocumentItem {
  id: string;
  type: string;
  url: string;
  verified: boolean;
}

interface DetailedCustomer extends Customer {
  documents?: DocumentItem[];
  transfers?: Array<{ id: string; reference: string; createdAt: string }>;
}

export default function CustomersPage() {
  const [data, setData] = useState<ListResponse<Customer> | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [kycFilter, setKycFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal de Expediente KYC
  const [selectedCustomer, setSelectedCustomer] = useState<DetailedCustomer | null>(null);

  // Modal de Edición
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    documentType: "CEDULA",
    documentNumber: "",
    email: "",
    phone: "",
  });

  // Modal de Eliminación
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (query) params.set("search", query);
      if (kycFilter) params.set("kycStatus", kycFilter);
      const res = await get<ListResponse<Customer>>(`/customers?${params}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  }, [query, kycFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const openDossier = async (c: Customer) => {
    try {
      const details = await get<DetailedCustomer>(`/customers/${c.id}`);
      setSelectedCustomer(details);
    } catch {
      setSelectedCustomer(c);
    }
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setEditForm({
      fullName: c.fullName,
      documentType: c.documentType,
      documentNumber: c.documentNumber,
      email: c.email || "",
      phone: c.phone || "",
    });
  };

  const saveCustomerEdit = async () => {
    if (!editingCustomer) return;
    setWorking(true);
    setError(null);
    setSuccess(null);
    try {
      const formattedPhone = normalizePhone(editForm.phone, editingCustomer.country?.code);
      await patch(`/customers/${editingCustomer.id}`, {
        ...editForm,
        phone: formattedPhone || undefined,
      });
      setSuccess("✅ Datos del cliente actualizados correctamente.");
      setEditingCustomer(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar el cliente.");
    } finally {
      setWorking(false);
    }
  };

  const confirmDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    setWorking(true);
    setError(null);
    setSuccess(null);
    try {
      await del(`/customers/${deletingCustomer.id}`);
      setSuccess(`🗑️ Cliente "${deletingCustomer.fullName}" eliminado correctamente.`);
      setDeletingCustomer(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar el cliente.");
    } finally {
      setWorking(false);
    }
  };

  const processKycDecision = async (id: string, decision: "APPROVE" | "REJECT") => {
    setWorking(true);
    setError(null);
    setSuccess(null);
    try {
      await post(`/customers/${id}/kyc`, { decision });
      setSuccess(
        decision === "APPROVE"
          ? "✅ Cliente aprobado exitosamente. La cuenta ha sido activada."
          : "❌ Solicitud de cliente rechazada.",
      );
      setSelectedCustomer(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar la decisión KYC");
    } finally {
      setWorking(false);
    }
  };

  const getKycBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <Badge className="bg-emerald-100 text-emerald-800 font-bold">🟢 Aprobado / Registrado</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-800 font-bold">🔴 Rechazado</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-900 font-bold">⏳ Pendiente de Revisión</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Gestión de Clientes (Remitentes)
          </h1>
          <p className="text-xs text-slate-500">
            Consulta, edición, eliminación y verificación de expedientes KYC.
          </p>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      {/* Tabs rápidos por Estado KYC */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { label: "📋 Todos los Clientes", value: "" },
          { label: "✅ Registrados / Aprobados", value: "APPROVED" },
          { label: "⏳ Pendientes de Revisión", value: "PENDING" },
          { label: "❌ Rechazados", value: "REJECTED" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setKycFilter(tab.value);
              setPage(1);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              kycFilter === tab.value
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Buscar por Nombre o Documento"
            placeholder="Ej. Juan Pérez, 1729384910..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-80"
          />
          <Button
            variant="secondary"
            onClick={() => {
              setQuery(search);
              setPage(1);
            }}
          >
            🔍 Buscar Cliente
          </Button>
        </div>
      </Card>

      {loading && !data ? (
        <Spinner />
      ) : (
        <Card title={`${data?.total ?? 0} registros encontrados`}>
          {data?.items.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No hay clientes registrados en esta categoría.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase font-semibold">
                  <th className="py-3">Cliente</th>
                  <th className="py-3">Documento / ID</th>
                  <th className="py-3">País / Contacto</th>
                  <th className="py-3">Estado KYC</th>
                  <th className="py-3">Registro</th>
                  <th className="py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3">
                      <div className="font-bold text-slate-900">{c.fullName}</div>
                      <div className="text-[11px] text-slate-400">{c.email ?? "Sin email"}</div>
                    </td>
                    <td className="py-3 text-slate-700 font-mono text-xs">
                      <span className="bg-slate-100 px-2 py-1 rounded font-bold">
                        {c.documentType}: {c.documentNumber}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 text-xs">
                      <div>📱 {fmtPhone(c.phone, c.country?.code)}</div>
                      <div className="text-slate-400">{c.country?.name ?? "Ecuador / Perú"}</div>
                    </td>
                    <td className="py-3">{getKycBadge(c.kycStatus)}</td>
                    <td className="py-3 text-xs text-slate-500">{c.createdAt ? fmtDate(c.createdAt) : "—"}</td>
                    <td className="py-3 text-right space-x-1">
                      <Button
                        variant="secondary"
                        className="text-xs px-2 py-1 font-bold"
                        onClick={() => openEditModal(c)}
                      >
                        ✏️ Editar
                      </Button>
                      <Button
                        variant="secondary"
                        className="text-xs px-2 py-1 font-bold text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setDeletingCustomer(c)}
                      >
                        🗑️ Eliminar
                      </Button>
                      <Button
                        variant="secondary"
                        className="text-xs px-2 py-1 font-bold"
                        onClick={() => openDossier(c)}
                      >
                        📂 KYC
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-4 flex justify-between items-center border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-500">
              Página {page} de {Math.max(1, Math.ceil((data?.total ?? 0) / 25))}
            </span>
            <div className="flex gap-2">
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
          </div>
        </Card>
      )}

      {/* Modal de Edición de Cliente */}
      {editingCustomer && (
        <Modal
          title={`✏️ Editar Cliente: ${editingCustomer.fullName}`}
          open={!!editingCustomer}
          onClose={() => setEditingCustomer(null)}
        >
          <div className="space-y-4 max-w-lg">
            <Input
              label="Nombre Completo"
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Tipo de Documento"
                value={editForm.documentType}
                onChange={(e) => setEditForm({ ...editForm, documentType: e.target.value as any })}
              >
                <option value="CEDULA">Cédula</option>
                <option value="RUC">RUC</option>
                <option value="DNI">DNI</option>
                <option value="PASSPORT">Pasaporte</option>
              </Select>
              <Input
                label="Número de Documento"
                value={editForm.documentNumber}
                onChange={(e) => setEditForm({ ...editForm, documentNumber: e.target.value })}
              />
            </div>
            <Input
              label="Teléfono / WhatsApp"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
            <Input
              label="Correo Electrónico (Opcional)"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />

            <div className="pt-3 border-t flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingCustomer(null)}>
                Cancelar
              </Button>
              <Button onClick={saveCustomerEdit} loading={working}>
                Guardar Cambios
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {deletingCustomer && (
        <Modal
          title={`🗑️ Confirmar Eliminación de Cliente`}
          open={!!deletingCustomer}
          onClose={() => setDeletingCustomer(null)}
        >
          <div className="space-y-4 max-w-md">
            <p className="text-sm text-slate-700">
              ¿Estás seguro de que deseas eliminar al cliente <strong className="text-slate-900">{deletingCustomer.fullName}</strong> ({deletingCustomer.documentType} {deletingCustomer.documentNumber})?
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
              ⚠️ Esta acción eliminará el registro del cliente de la base de datos.
            </p>
            <div className="pt-3 border-t flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeletingCustomer(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={confirmDeleteCustomer} loading={working}>
                Sí, Eliminar Cliente
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Expediente KYC del Cliente */}
      {selectedCustomer && (
        <Modal
          title={`📂 Expediente KYC: ${selectedCustomer.fullName}`}
          open={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        >
          <div className="space-y-5 max-w-xl">
            {/* Header del Cliente */}
            <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                  DATOS VERIFICADOS DE IDENTIDAD
                </span>
                {getKycBadge(selectedCustomer.kycStatus)}
              </div>
              <div className="text-xl font-black">{selectedCustomer.fullName}</div>
              <div className="text-xs text-slate-300 flex gap-4">
                <span>🪪 {selectedCustomer.documentType}: {selectedCustomer.documentNumber}</span>
                <span>📱 WhatsApp: {selectedCustomer.phone ?? "No registrado"}</span>
              </div>
            </div>

            {/* Documentos Adjuntos */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase">
                🖼️ Documentos de Identidad Subidos (Frontal & Selfie)
              </h4>
              {!selectedCustomer.documents || selectedCustomer.documents.length === 0 ? (
                <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-400">
                  El cliente registró su documento digitalmente ({selectedCustomer.documentType} {selectedCustomer.documentNumber}). No hay fotos físicas adjuntas adicionales.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {selectedCustomer.documents.map((doc) => (
                    <div key={doc.id} className="p-2 border border-slate-200 rounded-lg text-center space-y-2 bg-slate-50">
                      <span className="text-xs font-bold text-slate-700 uppercase">{doc.type}</span>
                      <div className="h-32 bg-slate-200 rounded flex items-center justify-center text-xs text-slate-500 font-mono">
                        {doc.url ? (
                          <img src={doc.url} alt={doc.type} className="h-full w-full object-cover rounded" />
                        ) : (
                          "Vista de imagen"
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Enlace rápido de contacto por WhatsApp */}
            {selectedCustomer.phone && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                <div className="text-xs text-emerald-900">
                  <strong>Notificación Directa por WhatsApp:</strong> Notifica al cliente el resultado de su validación.
                </div>
                <a
                  href={`https://wa.me/${selectedCustomer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                    `Hola ${selectedCustomer.fullName}, tu cuenta en Divisas ha sido verificada con éxito. Ya puedes realizar envíos Ecuador ↔ Perú desde tu app móvil.`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 flex items-center gap-1 shrink-0"
                >
                  💬 Enviar WhatsApp
                </a>
              </div>
            )}

            {/* Acciones KYC */}
            <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setSelectedCustomer(null)}
              >
                Cerrar Expediente
              </Button>
              <Button
                variant="danger"
                loading={working}
                onClick={() => processKycDecision(selectedCustomer.id, "REJECT")}
              >
                🔴 Rechazar KYC
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                loading={working}
                onClick={() => processKycDecision(selectedCustomer.id, "APPROVE")}
              >
                🟢 Aprobar y Activar Cuenta
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

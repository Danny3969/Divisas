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
import { del, get, patch } from "@/lib/api";
import { fmtDate, fmtPhone, normalizePhone } from "@/lib/format";
import type { Beneficiary } from "@/lib/types";

export default function BeneficiariesPage() {
  const [items, setItems] = useState<Beneficiary[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal de Edición
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    documentType: "DNI",
    documentNumber: "",
    phone: "",
  });

  // Modal de Eliminación
  const [deletingBeneficiary, setDeletingBeneficiary] = useState<Beneficiary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      const res = await get<Beneficiary[]>(`/beneficiaries?${params}`);
      setItems(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar beneficiarios");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const openEditModal = (b: Beneficiary) => {
    setEditingBeneficiary(b);
    setEditForm({
      fullName: b.fullName,
      documentType: b.documentType,
      documentNumber: b.documentNumber,
      phone: b.phone || "",
    });
  };

  const saveEdit = async () => {
    if (!editingBeneficiary) return;
    setWorking(true);
    setError(null);
    setSuccess(null);
    try {
      const formattedPhone = normalizePhone(editForm.phone);
      await patch(`/beneficiaries/${editingBeneficiary.id}`, {
        ...editForm,
        phone: formattedPhone || undefined,
      });
      setSuccess("✅ Datos del beneficiario actualizados correctamente.");
      setEditingBeneficiary(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar beneficiario");
    } finally {
      setWorking(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingBeneficiary) return;
    setWorking(true);
    setError(null);
    setSuccess(null);
    try {
      await del(`/beneficiaries/${deletingBeneficiary.id}`);
      setSuccess(`🗑️ Beneficiario "${deletingBeneficiary.fullName}" eliminado correctamente.`);
      setDeletingBeneficiary(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar beneficiario");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Gestión de Beneficiarios (Destinatarios)
          </h1>
          <p className="text-xs text-slate-500">
            Administración de beneficiarios para pagos por Efectivo, Yape y Transferencias Bancarias.
          </p>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Buscar Beneficiario por Nombre, Documento o Teléfono Yape"
            placeholder="Ej. María Pérez, 40000001, 987654321..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-96"
          />
          <Button
            variant="secondary"
            onClick={() => setQuery(search)}
          >
            🔍 Buscar Beneficiario
          </Button>
        </div>
      </Card>

      {loading && items.length === 0 ? (
        <Spinner />
      ) : (
        <Card title={`${items.length} beneficiarios registrados`}>
          {items.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No hay beneficiarios registrados que coincidan con la búsqueda.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase font-semibold">
                  <th className="py-3">Beneficiario</th>
                  <th className="py-3">Documento</th>
                  <th className="py-3">Cliente Titular (Remitente)</th>
                  <th className="py-3">Teléfono / Yape</th>
                  <th className="py-3">Cuentas Bancarias / Medios</th>
                  <th className="py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3">
                      <div className="font-bold text-slate-900">{b.fullName}</div>
                      <div className="text-[11px] text-slate-400">ID: {b.id.substring(0, 8)}…</div>
                    </td>
                    <td className="py-3 font-mono text-xs text-slate-700">
                      <span className="bg-slate-100 px-2 py-1 rounded font-bold">
                        {b.documentType}: {b.documentNumber}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-slate-600">
                      {b.customer ? (
                        <div>
                          <span className="font-semibold text-slate-800">{b.customer.fullName}</span>
                          <div className="text-[11px] text-slate-400">
                            {b.customer.documentType} {b.customer.documentNumber}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Cliente general</span>
                      )}
                    </td>
                    <td className="py-3 text-xs font-mono font-bold text-emerald-800">
                      {b.phone ? `📱 ${fmtPhone(b.phone)}` : <span className="text-slate-400 font-normal">Sin teléfono</span>}
                    </td>
                    <td className="py-3 text-xs space-y-1">
                      {b.accounts && b.accounts.length > 0 ? (
                        b.accounts.map((acc) => (
                          <div key={acc.id} className="bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                            <span className="font-bold text-slate-800">{acc.bankName}:</span>{" "}
                            <span className="font-mono">{acc.accountNumber}</span> ({acc.currency})
                          </div>
                        ))
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 text-[10px]">💵 Pago en Ventanilla / Yape</Badge>
                      )}
                    </td>
                    <td className="py-3 text-right space-x-1">
                      <Button
                        variant="secondary"
                        className="text-xs px-2 py-1 font-bold"
                        onClick={() => openEditModal(b)}
                      >
                        ✏️ Editar
                      </Button>
                      <Button
                        variant="secondary"
                        className="text-xs px-2 py-1 font-bold text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setDeletingBeneficiary(b)}
                      >
                        🗑️ Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Modal de Edición de Beneficiario */}
      {editingBeneficiary && (
        <Modal
          title={`✏️ Editar Beneficiario: ${editingBeneficiary.fullName}`}
          open={!!editingBeneficiary}
          onClose={() => setEditingBeneficiary(null)}
        >
          <div className="space-y-4 max-w-lg">
            <Input
              label="Nombre Completo del Beneficiario"
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Tipo de Documento"
                value={editForm.documentType}
                onChange={(e) => setEditForm({ ...editForm, documentType: e.target.value })}
              >
                <option value="DNI">DNI (Perú)</option>
                <option value="CEDULA">Cédula</option>
                <option value="RUC">RUC</option>
                <option value="PASSPORT">Pasaporte</option>
              </Select>
              <Input
                label="Número de Documento"
                value={editForm.documentNumber}
                onChange={(e) => setEditForm({ ...editForm, documentNumber: e.target.value })}
              />
            </div>
            <Input
              label="Número de Teléfono Yape / Contacto"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              placeholder="Ej. 987654321"
            />

            <div className="pt-3 border-t flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingBeneficiary(null)}>
                Cancelar
              </Button>
              <Button onClick={saveEdit} loading={working}>
                Guardar Cambios
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {deletingBeneficiary && (
        <Modal
          title={`🗑️ Confirmar Eliminación de Beneficiario`}
          open={!!deletingBeneficiary}
          onClose={() => setDeletingBeneficiary(null)}
        >
          <div className="space-y-4 max-w-md">
            <p className="text-sm text-slate-700">
              ¿Estás seguro de que deseas eliminar al beneficiario <strong className="text-slate-900">{deletingBeneficiary.fullName}</strong> ({deletingBeneficiary.documentType} {deletingBeneficiary.documentNumber})?
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
              ⚠️ Esta acción eliminará el registro del beneficiario y sus cuentas asociadas.
            </p>
            <div className="pt-3 border-t flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeletingBeneficiary(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={confirmDelete} loading={working}>
                Sí, Eliminar Beneficiario
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

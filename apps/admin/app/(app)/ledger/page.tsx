"use client";

import { useEffect, useState, useMemo } from "react";
import { Alert, Badge, Button, Card, Input, Modal, Select, Spinner } from "@/components/ui";
import { get, post, del } from "@/lib/api";
import { fmtDate, fmtMoney } from "@/lib/format";
import type {
  FinancialSummary,
  Expense,
  AccountTransferRecord,
  CapitalMovementRecord,
  LedgerAccount,
  LedgerEntry,
} from "@/lib/types";

const CATEGORY_NAMES: Record<string, { label: string; icon: string }> = {
  RENT: { label: "Alquiler y Arriendos", icon: "🏢" },
  UTILITIES: { label: "Servicios Básicos (Luz/Agua/Internet)", icon: "💡" },
  PAYROLL: { label: "Sueldos y Nómina", icon: "👥" },
  BANK_FEES: { label: "Comisiones Bancarias", icon: "🏦" },
  SOFTWARE_HOSTING: { label: "Software y Servidores", icon: "💻" },
  OFFICE_SUPPLIES: { label: "Suministros y Oficina", icon: "📦" },
  MARKETING: { label: "Publicidad y Marketing", icon: "📢" },
  TAXES: { label: "Impuestos y Tasas", icon: "🏛️" },
  OTHER: { label: "Gastos Operativos Varios", icon: "🏷️" },
};

export default function LedgerPage() {
  const [activeTab, setActiveTab] = useState<"summary" | "expenses" | "transfers" | "capital" | "ledger">("summary");
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accountTransfers, setAccountTransfers] = useState<AccountTransferRecord[]>([]);
  const [capitalMovements, setCapitalMovements] = useState<CapitalMovementRecord[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState("");

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modales
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showCapitalModal, setShowCapitalModal] = useState(false);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  // Formulario Gasto / Factura
  const [expenseForm, setExpenseForm] = useState({
    category: "UTILITIES",
    supplierName: "",
    supplierTaxId: "",
    invoiceNumber: "",
    currency: "USD",
    subtotal: "100",
    taxRate: "15", // Ecuador 15%, Perú 18%, 0%
    taxAmount: "15",
    total: "115",
    paymentSourceType: "BANK" as "BANK" | "CASH",
    bankAccountId: "",
    cashAccountId: "",
    paidAt: new Date().toISOString().split("T")[0],
    receiptUrl: "",
    notes: "",
  });

  // Formulario Traspaso entre cuentas
  const [transferForm, setTransferForm] = useState({
    fromType: "CASH" as "BANK" | "CASH",
    fromBankAccountId: "",
    fromCashAccountId: "",
    toType: "BANK" as "BANK" | "CASH",
    toBankAccountId: "",
    toCashAccountId: "",
    amount: "500",
    currency: "USD",
    reference: "",
    receiptUrl: "",
    description: "",
  });

  // Formulario Movimiento de Capital
  const [capitalForm, setCapitalForm] = useState({
    type: "INJECTION" as "INJECTION" | "WITHDRAWAL",
    destinationType: "BANK" as "BANK" | "CASH",
    bankAccountId: "",
    cashAccountId: "",
    amount: "1000",
    currency: "USD",
    partnerName: "",
    concept: "Aporte inicial de liquidez",
    receiptUrl: "",
  });

  // Filtros de gastos
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("");
  const [expenseCurrencyFilter, setExpenseCurrencyFilter] = useState("");

  const loadAllData = async () => {
    try {
      const [sum, exp, trf, cap, accs, ents] = await Promise.all([
        get<FinancialSummary>("/accounting/summary"),
        get<Expense[]>("/accounting/expenses"),
        get<AccountTransferRecord[]>("/accounting/account-transfers"),
        get<CapitalMovementRecord[]>("/accounting/capital-movements"),
        get<LedgerAccount[]>("/ledger/accounts"),
        get<LedgerEntry[]>("/ledger/entries?limit=150"),
      ]);
      setSummary(sum);
      setExpenses(exp);
      setAccountTransfers(trf);
      setCapitalMovements(cap);
      setLedgerAccounts(accs);
      setLedgerEntries(ents);

      // Preseleccionar cuentas por defecto en los formularios
      if (sum.liquidity.banks.accounts.length > 0) {
        if (!expenseForm.bankAccountId) {
          setExpenseForm((f) => ({ ...f, bankAccountId: sum.liquidity.banks.accounts[0].id }));
        }
        if (!transferForm.toBankAccountId) {
          setTransferForm((f) => ({ ...f, toBankAccountId: sum.liquidity.banks.accounts[0].id }));
        }
        if (!capitalForm.bankAccountId) {
          setCapitalForm((f) => ({ ...f, bankAccountId: sum.liquidity.banks.accounts[0].id }));
        }
      }
      if (sum.liquidity.cash.accounts.length > 0) {
        if (!expenseForm.cashAccountId) {
          setExpenseForm((f) => ({ ...f, cashAccountId: sum.liquidity.cash.accounts[0].id }));
        }
        if (!transferForm.fromCashAccountId) {
          setTransferForm((f) => ({ ...f, fromCashAccountId: sum.liquidity.cash.accounts[0].id }));
        }
        if (!capitalForm.cashAccountId) {
          setCapitalForm((f) => ({ ...f, cashAccountId: sum.liquidity.cash.accounts[0].id }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos contables");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Recalcular impuestos y totales en formulario de gastos
  const handleExpenseAmountChange = (field: "subtotal" | "taxRate" | "total", val: string) => {
    if (field === "subtotal") {
      const sub = parseFloat(val) || 0;
      const rate = parseFloat(expenseForm.taxRate) || 0;
      const tax = Math.round(((sub * rate) / 100) * 100) / 100;
      const tot = Math.round((sub + tax) * 100) / 100;
      setExpenseForm((f) => ({ ...f, subtotal: val, taxAmount: tax.toString(), total: tot.toString() }));
    } else if (field === "taxRate") {
      const rate = parseFloat(val) || 0;
      const sub = parseFloat(expenseForm.subtotal) || 0;
      const tax = Math.round(((sub * rate) / 100) * 100) / 100;
      const tot = Math.round((sub + tax) * 100) / 100;
      setExpenseForm((f) => ({ ...f, taxRate: val, taxAmount: tax.toString(), total: tot.toString() }));
    } else if (field === "total") {
      const tot = parseFloat(val) || 0;
      const rate = parseFloat(expenseForm.taxRate) || 0;
      const sub = rate > 0 ? Math.round((tot / (1 + rate / 100)) * 100) / 100 : tot;
      const tax = Math.round((tot - sub) * 100) / 100;
      setExpenseForm((f) => ({ ...f, total: val, subtotal: sub.toString(), taxAmount: tax.toString() }));
    }
  };

  // Manejador para adjuntar foto / archivo en Base64
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: "expense" | "transfer" | "capital") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("El archivo es demasiado grande (máximo 5MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (target === "expense") setExpenseForm((f) => ({ ...f, receiptUrl: result }));
      else if (target === "transfer") setTransferForm((f) => ({ ...f, receiptUrl: result }));
      else if (target === "capital") setCapitalForm((f) => ({ ...f, receiptUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  // Crear Gasto
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      await post("/accounting/expenses", {
        category: expenseForm.category,
        supplierName: expenseForm.supplierName,
        supplierTaxId: expenseForm.supplierTaxId || undefined,
        invoiceNumber: expenseForm.invoiceNumber || undefined,
        currency: expenseForm.currency,
        subtotal: parseFloat(expenseForm.subtotal),
        taxRate: parseFloat(expenseForm.taxRate),
        taxAmount: parseFloat(expenseForm.taxAmount),
        total: parseFloat(expenseForm.total),
        paymentSourceType: expenseForm.paymentSourceType,
        bankAccountId: expenseForm.paymentSourceType === "BANK" ? expenseForm.bankAccountId : undefined,
        cashAccountId: expenseForm.paymentSourceType === "CASH" ? expenseForm.cashAccountId : undefined,
        paidAt: expenseForm.paidAt ? new Date(expenseForm.paidAt).toISOString() : undefined,
        receiptUrl: expenseForm.receiptUrl || undefined,
        notes: expenseForm.notes || undefined,
      });
      setSuccess("¡Gasto registrado exitosamente con asiento contable automático!");
      setShowExpenseModal(false);
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el gasto");
    } finally {
      setWorking(false);
    }
  };

  // Eliminar Gasto
  const handleDeleteExpense = async (id: string, num: string) => {
    if (!confirm(`¿Estás seguro de eliminar el gasto ${num}? El saldo descontado será devuelto y el asiento revertido.`)) return;
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      await del(`/accounting/expenses/${id}`);
      setSuccess(`Gasto ${num} revertido y eliminado.`);
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar el gasto");
    } finally {
      setWorking(false);
    }
  };

  // Crear Traspaso entre Cuentas
  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      await post("/accounting/account-transfers", {
        fromType: transferForm.fromType,
        fromBankAccountId: transferForm.fromType === "BANK" ? transferForm.fromBankAccountId : undefined,
        fromCashAccountId: transferForm.fromType === "CASH" ? transferForm.fromCashAccountId : undefined,
        toType: transferForm.toType,
        toBankAccountId: transferForm.toType === "BANK" ? transferForm.toBankAccountId : undefined,
        toCashAccountId: transferForm.toType === "CASH" ? transferForm.toCashAccountId : undefined,
        amount: parseFloat(transferForm.amount),
        currency: transferForm.currency,
        reference: transferForm.reference || undefined,
        receiptUrl: transferForm.receiptUrl || undefined,
        description: transferForm.description || undefined,
      });
      setSuccess("¡Traspaso de fondos registrado con éxito!");
      setShowTransferModal(false);
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al transferir fondos");
    } finally {
      setWorking(false);
    }
  };

  // Crear Movimiento de Capital
  const handleSubmitCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      await post("/accounting/capital-movements", {
        type: capitalForm.type,
        destinationType: capitalForm.destinationType,
        bankAccountId: capitalForm.destinationType === "BANK" ? capitalForm.bankAccountId : undefined,
        cashAccountId: capitalForm.destinationType === "CASH" ? capitalForm.cashAccountId : undefined,
        amount: parseFloat(capitalForm.amount),
        currency: capitalForm.currency,
        partnerName: capitalForm.partnerName || undefined,
        concept: capitalForm.concept || undefined,
        receiptUrl: capitalForm.receiptUrl || undefined,
      });
      setSuccess("¡Movimiento de capital registrado exitosamente!");
      setShowCapitalModal(false);
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar capital");
    } finally {
      setWorking(false);
    }
  };

  // Exportar Libro a CSV
  const exportLedgerToCsv = () => {
    const headers = ["Fecha", "Grupo Asiento", "Cuenta Código", "Cuenta Nombre", "Lado", "Monto", "Moneda", "Descripción"];
    const rows = ledgerEntries.map((e) => [
      new Date(e.createdAt).toISOString(),
      (e as any).entryGroup || "—",
      e.account.code,
      `"${e.account.name.replace(/"/g, '""')}"`,
      e.side,
      e.amount,
      e.currency || e.account.currency,
      `"${(e.description ?? "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Libro_Contable_Divisas_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtro de gastos
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (expenseCategoryFilter && e.category !== expenseCategoryFilter) return false;
      if (expenseCurrencyFilter && e.currency !== expenseCurrencyFilter) return false;
      if (expenseSearch) {
        const q = expenseSearch.toLowerCase();
        const sup = e.supplierName.toLowerCase();
        const inv = (e.invoiceNumber || "").toLowerCase();
        const num = e.expenseNumber.toLowerCase();
        if (!sup.includes(q) && !inv.includes(q) && !num.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, expenseCategoryFilter, expenseCurrencyFilter, expenseSearch]);

  if (loading && !summary) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Header con Acciones Rápidas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            📊 Contabilidad y Tesorería Financiera
          </h1>
          <p className="text-xs text-slate-500">
            Control de saldos bancarios, efectivo, gastos, facturas e impuestos con cálculo automático de ganancias.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowExpenseModal(true)} variant="primary" className="font-bold shadow-sm">
            ➕ Registrar Gasto / Factura
          </Button>
          <Button onClick={() => setShowTransferModal(true)} variant="secondary" className="font-semibold shadow-sm">
            🔄 Mover Dinero
          </Button>
          <Button onClick={() => setShowCapitalModal(true)} variant="secondary" className="font-semibold shadow-sm">
            💵 Aporte / Retiro de Capital
          </Button>
        </div>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      {/* Navegación por Pestañas */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-2 pt-2 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "summary"
              ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          📈 Resumen & Estado P&L
        </button>
        <button
          onClick={() => setActiveTab("expenses")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "expenses"
              ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          🧾 Facturas y Gastos ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab("transfers")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "transfers"
              ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          🔄 Traspasos entre Cuentas ({accountTransfers.length})
        </button>
        <button
          onClick={() => setActiveTab("capital")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "capital"
              ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          💵 Capital y Socios ({capitalMovements.length})
        </button>
        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "ledger"
              ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          📚 Libro Diario & Plan Contable
        </button>
      </div>

      {/* ==================== TAB 1: RESUMEN Y P&L ==================== */}
      {activeTab === "summary" && summary && (
        <div className="space-y-6">
          {/* Tarjetas de Liquidez Global */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-emerald-500">
              <div className="text-xs font-semibold text-slate-500 uppercase">Liquidez Total USD (Ecuador)</div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {fmtMoney(summary.liquidity.totalUsd, "USD")}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex justify-between">
                <span>Bancos: {fmtMoney(summary.liquidity.banks.totalUsd, "USD")}</span>
                <span>Cajas: {fmtMoney(summary.liquidity.cash.totalUsd, "USD")}</span>
              </div>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <div className="text-xs font-semibold text-slate-500 uppercase">Liquidez Total PEN (Perú)</div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {fmtMoney(summary.liquidity.totalPen, "PEN")}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex justify-between">
                <span>Bancos: {fmtMoney(summary.liquidity.banks.totalPen, "PEN")}</span>
                <span>Cajas: {fmtMoney(summary.liquidity.cash.totalPen, "PEN")}</span>
              </div>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <div className="text-xs font-semibold text-slate-500 uppercase">Ganancia Neta (USD)</div>
              <div className={`text-2xl font-black mt-1 ${summary.pnl.netProfit.usd >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {fmtMoney(summary.pnl.netProfit.usd, "USD")}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Ingresos: {fmtMoney(summary.pnl.revenue.totalRevenueUsd, "USD")} | Gastos: {fmtMoney(summary.pnl.expenses.totalUsd, "USD")}
              </div>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <div className="text-xs font-semibold text-slate-500 uppercase">Ganancia Neta (PEN)</div>
              <div className={`text-2xl font-black mt-1 ${summary.pnl.netProfit.pen >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {fmtMoney(summary.pnl.netProfit.pen, "PEN")}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Comisiones: {fmtMoney(summary.pnl.revenue.feesPen, "PEN")} | Gastos: {fmtMoney(summary.pnl.expenses.totalPen, "PEN")}
              </div>
            </Card>
          </div>

          {/* Cuentas Bancarias y Cajas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="🏦 Cuentas Bancarias Oficiales">
              <div className="space-y-3">
                {summary.liquidity.banks.accounts.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                        {b.name}
                        <Badge className="bg-slate-200 text-slate-700 font-mono text-[10px]">{b.currency}</Badge>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">N° {b.accountNumber} · {b.country}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-slate-900">{fmtMoney(b.balance, b.currency)}</div>
                      <span className="text-[10px] text-emerald-600 font-semibold">● Activa</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="💵 Cajas de Efectivo en Agencias">
              <div className="space-y-3">
                {summary.liquidity.cash.accounts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                        Caja {c.code}
                        <Badge className={c.currency === "USD" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>
                          {c.country} ({c.currency})
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">Efectivo físico disponible</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-slate-900">{fmtMoney(c.balance, c.currency)}</div>
                      <span className="text-[10px] text-emerald-600 font-semibold">● Operativa</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Estado de Pérdidas y Ganancias (P&L) */}
          <Card title="📊 Estado de Resultados (P&L — Ganancias vs Gastos)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sección Ingresos */}
              <div className="space-y-3 border-r-0 md:border-r border-slate-200 md:pr-4">
                <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                  🟢 1. Ingresos Operativos
                </h3>
                <div className="p-3 bg-emerald-50/50 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Comisiones por Giros (USD):</span>
                    <span className="font-semibold text-slate-900">{fmtMoney(summary.pnl.revenue.feesUsd, "USD")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Comisiones por Giros (PEN):</span>
                    <span className="font-semibold text-slate-900">{fmtMoney(summary.pnl.revenue.feesPen, "PEN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Margen FX (Spread cambiario estimado):</span>
                    <span className="font-semibold text-slate-900">{fmtMoney(summary.pnl.revenue.fxProfitUsd, "USD")}</span>
                  </div>
                  <div className="border-t border-emerald-200 pt-2 flex justify-between font-bold text-emerald-900">
                    <span>Total Ingresos Generados:</span>
                    <span>{fmtMoney(summary.pnl.revenue.totalRevenueUsd, "USD")}</span>
                  </div>
                </div>
              </div>

              {/* Sección Gastos */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-red-800 uppercase tracking-wide flex items-center gap-1.5">
                  🔴 2. Gastos Operativos y Facturas
                </h3>
                <div className="p-3 bg-red-50/50 rounded-lg space-y-2 text-sm">
                  {Object.keys(summary.pnl.expenses.byCategory).length === 0 ? (
                    <div className="text-xs text-slate-400 py-4 text-center">Sin gastos registrados en el sistema.</div>
                  ) : (
                    Object.entries(summary.pnl.expenses.byCategory).map(([cat, data]) => {
                      const meta = CATEGORY_NAMES[cat] || { label: cat, icon: "🏷️" };
                      return (
                        <div key={cat} className="flex justify-between text-xs">
                          <span className="text-slate-700 flex items-center gap-1">
                            <span>{meta.icon}</span> {meta.label} ({data.count}):
                          </span>
                          <span className="font-medium text-slate-900">
                            {data.totalUsd > 0 && fmtMoney(data.totalUsd, "USD")}
                            {data.totalUsd > 0 && data.totalPen > 0 && " + "}
                            {data.totalPen > 0 && fmtMoney(data.totalPen, "PEN")}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div className="border-t border-red-200 pt-2 flex justify-between font-bold text-red-900">
                    <span>Total Gastos ({summary.pnl.expenses.count}):</span>
                    <span>{fmtMoney(summary.pnl.expenses.totalUsd, "USD")}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ==================== TAB 2: GASTOS Y FACTURAS ==================== */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div className="w-full md:w-80">
              <Input
                placeholder="🔍 Buscar proveedor, N° factura o código..."
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Select value={expenseCategoryFilter} onChange={(e) => setExpenseCategoryFilter(e.target.value)}>
                <option value="">Todas las Categorías</option>
                {Object.entries(CATEGORY_NAMES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.icon} {v.label}
                  </option>
                ))}
              </Select>
              <Select value={expenseCurrencyFilter} onChange={(e) => setExpenseCurrencyFilter(e.target.value)}>
                <option value="">Todas las Monedas</option>
                <option value="USD">USD ($)</option>
                <option value="PEN">PEN (S/)</option>
              </Select>
            </div>
          </div>

          <Card title={`🧾 Historial de Gastos y Facturas (${filteredExpenses.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 bg-slate-50">
                    <th className="py-3 px-3">Código</th>
                    <th className="py-3 px-3">Fecha</th>
                    <th className="py-3 px-3">Proveedor / Beneficiario</th>
                    <th className="py-3 px-3">Categoría</th>
                    <th className="py-3 px-3">N° Factura</th>
                    <th className="py-3 px-3 text-right">Subtotal</th>
                    <th className="py-3 px-3 text-right">Impuesto</th>
                    <th className="py-3 px-3 text-right">Total</th>
                    <th className="py-3 px-3">Cuenta Pago</th>
                    <th className="py-3 px-3 text-center">Comprobante</th>
                    <th className="py-3 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-xs text-slate-400">
                        No se encontraron gastos con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => {
                      const meta = CATEGORY_NAMES[exp.category] || { label: exp.category, icon: "🏷️" };
                      const accountLabel =
                        exp.paymentSourceType === "BANK"
                          ? `🏦 ${exp.bankAccount?.bankName ?? "Banco"}`
                          : `💵 Caja ${exp.cashAccount?.code ?? "Efectivo"}`;

                      return (
                        <tr key={exp.id} className="border-b border-slate-100 hover:bg-slate-50 text-xs">
                          <td className="py-3 px-3 font-mono font-bold text-blue-700">{exp.expenseNumber}</td>
                          <td className="py-3 px-3 text-slate-600">{fmtDate(exp.paidAt)}</td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900">{exp.supplierName}</div>
                            {exp.supplierTaxId && (
                              <div className="text-[10px] text-slate-400 font-mono">RUC/CI: {exp.supplierTaxId}</div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <Badge className="bg-slate-100 text-slate-800 text-[11px] font-medium">
                              {meta.icon} {meta.label}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-700">{exp.invoiceNumber || "—"}</td>
                          <td className="py-3 px-3 text-right font-medium">{fmtMoney(exp.subtotal, exp.currency)}</td>
                          <td className="py-3 px-3 text-right text-slate-500">
                            {Number(exp.taxAmount) > 0 ? (
                              <span>
                                {fmtMoney(exp.taxAmount, exp.currency)} <span className="text-[10px] text-slate-400">({exp.taxRate}%)</span>
                              </span>
                            ) : (
                              "Exento"
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900">{fmtMoney(exp.total, exp.currency)}</td>
                          <td className="py-3 px-3 font-medium text-slate-700">{accountLabel}</td>
                          <td className="py-3 px-3 text-center">
                            {exp.receiptUrl ? (
                              <button
                                onClick={() => setPreviewReceiptUrl(exp.receiptUrl!)}
                                className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded font-semibold"
                              >
                                📎 Ver Foto
                              </button>
                            ) : (
                              <span className="text-slate-300 text-[10px]">Sin archivo</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleDeleteExpense(exp.id, exp.expenseNumber)}
                              disabled={working}
                              className="text-red-500 hover:text-red-700 p-1 font-bold"
                              title="Eliminar y revertir gasto"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ==================== TAB 3: TRASPASOS ENTRE CUENTAS ==================== */}
      {activeTab === "transfers" && (
        <Card title={`🔄 Historial de Traspasos y Fondeos Internos (${accountTransfers.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 bg-slate-50">
                  <th className="py-3 px-3">N° Traspaso</th>
                  <th className="py-3 px-3">Fecha</th>
                  <th className="py-3 px-3">Origen</th>
                  <th className="py-3 px-3">Destino</th>
                  <th className="py-3 px-3 text-right">Monto</th>
                  <th className="py-3 px-3">Referencia / Comprobante</th>
                  <th className="py-3 px-3">Descripción</th>
                  <th className="py-3 px-3 text-center">Adjunto</th>
                </tr>
              </thead>
              <tbody>
                {accountTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-xs text-slate-400">
                      No hay traspasos registrados. Usa el botón "🔄 Mover Dinero" arriba.
                    </td>
                  </tr>
                ) : (
                  accountTransfers.map((trf) => (
                    <tr key={trf.id} className="border-b border-slate-100 hover:bg-slate-50 text-xs">
                      <td className="py-3 px-3 font-mono font-bold text-blue-700">{trf.transferNumber}</td>
                      <td className="py-3 px-3 text-slate-600">{fmtDate(trf.transferredAt)}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {trf.fromType === "BANK"
                          ? `🏦 ${trf.fromBankAccount?.bankName ?? "Banco"}`
                          : `💵 Caja ${trf.fromCashAccount?.code ?? "Efectivo"}`}
                      </td>
                      <td className="py-3 px-3 font-semibold text-emerald-800">
                        {trf.toType === "BANK"
                          ? `🏦 ${trf.toBankAccount?.bankName ?? "Banco"}`
                          : `💵 Caja ${trf.toCashAccount?.code ?? "Efectivo"}`}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">{fmtMoney(trf.amount, trf.currency)}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{trf.reference || "—"}</td>
                      <td className="py-3 px-3 text-slate-600">{trf.description || "—"}</td>
                      <td className="py-3 px-3 text-center">
                        {trf.receiptUrl ? (
                          <button
                            onClick={() => setPreviewReceiptUrl(trf.receiptUrl!)}
                            className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded font-semibold"
                          >
                            📎 Ver
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[10px]">Sin archivo</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ==================== TAB 4: CAPITAL Y SOCIOS ==================== */}
      {activeTab === "capital" && (
        <Card title={`💵 Movimientos de Capital Social y Dividendos (${capitalMovements.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 bg-slate-50">
                  <th className="py-3 px-3">Código</th>
                  <th className="py-3 px-3">Fecha</th>
                  <th className="py-3 px-3">Tipo Movimiento</th>
                  <th className="py-3 px-3">Socio / Aportante</th>
                  <th className="py-3 px-3">Cuenta Afectada</th>
                  <th className="py-3 px-3 text-right">Monto</th>
                  <th className="py-3 px-3">Concepto / Motivo</th>
                  <th className="py-3 px-3 text-center">Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {capitalMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-xs text-slate-400">
                      Sin movimientos de capital registrados.
                    </td>
                  </tr>
                ) : (
                  capitalMovements.map((cap) => (
                    <tr key={cap.id} className="border-b border-slate-100 hover:bg-slate-50 text-xs">
                      <td className="py-3 px-3 font-mono font-bold text-blue-700">{cap.movementNumber}</td>
                      <td className="py-3 px-3 text-slate-600">{fmtDate(cap.createdAt)}</td>
                      <td className="py-3 px-3">
                        <Badge
                          className={
                            cap.type === "INJECTION"
                              ? "bg-emerald-100 text-emerald-800 font-bold"
                              : "bg-purple-100 text-purple-800 font-bold"
                          }
                        >
                          {cap.type === "INJECTION" ? "➕ Aporte de Capital" : "💸 Retiro de Utilidad"}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{cap.partnerName || "Socio General"}</td>
                      <td className="py-3 px-3 font-medium text-slate-700">
                        {cap.destinationType === "BANK"
                          ? `🏦 ${cap.bankAccount?.bankName ?? "Banco"}`
                          : `💵 Caja ${cap.cashAccount?.code ?? "Efectivo"}`}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-900">{fmtMoney(cap.amount, cap.currency)}</td>
                      <td className="py-3 px-3 text-slate-600">{cap.concept || "—"}</td>
                      <td className="py-3 px-3 text-center">
                        {cap.receiptUrl ? (
                          <button
                            onClick={() => setPreviewReceiptUrl(cap.receiptUrl!)}
                            className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded font-semibold"
                          >
                            📎 Ver
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[10px]">Sin archivo</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ==================== TAB 5: LIBRO DIARIO Y PLAN DE CUENTAS ==================== */}
      {activeTab === "ledger" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">📚 Plan de Cuentas y Libro Diario General</h2>
            <Button onClick={exportLedgerToCsv} variant="secondary" className="font-semibold text-xs">
              📥 Exportar Libro a Excel/CSV
            </Button>
          </div>

          <Card title="Plan General de Cuentas Contables">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 bg-slate-50">
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Nombre de Cuenta</th>
                    <th className="py-2.5 px-3">Tipo Contable</th>
                    <th className="py-2.5 px-3">Moneda</th>
                    <th className="py-2.5 px-3 text-right">Saldo Calculado</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerAccounts.map((a) => (
                    <tr
                      key={a.id}
                      className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 text-xs ${
                        selectedLedgerAccount === a.id ? "bg-blue-50/70 font-semibold" : ""
                      }`}
                      onClick={() => setSelectedLedgerAccount(selectedLedgerAccount === a.id ? "" : a.id)}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{a.code}</td>
                      <td className="py-2.5 px-3">{a.name}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          className={
                            a.type === "ASSET"
                              ? "bg-emerald-100 text-emerald-800"
                              : a.type === "LIABILITY"
                              ? "bg-amber-100 text-amber-800"
                              : a.type === "INCOME"
                              ? "bg-blue-100 text-blue-800"
                              : a.type === "EXPENSE"
                              ? "bg-red-100 text-red-800"
                              : "bg-purple-100 text-purple-800"
                          }
                        >
                          {a.type}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-mono">{a.currency}</td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        {fmtMoney(a.balance, a.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={selectedLedgerAccount ? "Asientos de la Cuenta Seleccionada" : "Libro Diario (Últimos Asientos)"}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 bg-slate-50">
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Asiento / Ref</th>
                    <th className="py-2.5 px-3">Cuenta</th>
                    <th className="py-2.5 px-3">Lado</th>
                    <th className="py-2.5 px-3 text-right">Monto</th>
                    <th className="py-2.5 px-3">Concepto / Glosa</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries
                    .filter((e) => !selectedLedgerAccount || e.accountId === selectedLedgerAccount)
                    .map((e) => (
                      <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 text-xs">
                        <td className="py-2.5 px-3 text-slate-500">{fmtDate(e.createdAt)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{(e as any).entryGroup ?? "—"}</td>
                        <td className="py-2.5 px-3 font-mono">
                          {e.account.code} · {e.account.name}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            className={
                              e.side === "DEBIT" ? "bg-red-100 text-red-800 font-bold" : "bg-emerald-100 text-emerald-800 font-bold"
                            }
                          >
                            {e.side === "DEBIT" ? "DÉBITO (Debe)" : "CRÉDITO (Haber)"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          {fmtMoney(e.amount, e.currency || e.account.currency)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{e.description ?? "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ==================== MODAL REGISTRAR GASTO / FACTURA ==================== */}
      <Modal open={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="🧾 Registrar Gasto o Factura de Proveedor">
        <form onSubmit={handleSubmitExpense} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Categoría del Gasto"
              value={expenseForm.category}
              onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}
            >
              {Object.entries(CATEGORY_NAMES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </Select>

            <Select
              label="País y Moneda"
              value={expenseForm.currency}
              onChange={(e) => {
                const cur = e.target.value;
                const defaultRate = cur === "USD" ? "15" : "18"; // IVA EC 15% o IGV PE 18%
                setExpenseForm((f) => ({ ...f, currency: cur, taxRate: defaultRate }));
                handleExpenseAmountChange("taxRate", defaultRate);
              }}
            >
              <option value="USD">🇪🇨 Ecuador — Dólar (USD)</option>
              <option value="PEN">🇵🇪 Perú — Soles (PEN)</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Nombre del Proveedor o Persona"
              placeholder="Ej: Claro / CNT / Propietario Local"
              value={expenseForm.supplierName}
              onChange={(e) => setExpenseForm((f) => ({ ...f, supplierName: e.target.value }))}
              required
            />
            <Input
              label="RUC / DNI / CI del Proveedor (Opcional)"
              placeholder="Ej: 1790000000001"
              value={expenseForm.supplierTaxId}
              onChange={(e) => setExpenseForm((f) => ({ ...f, supplierTaxId: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="N° de Factura / Boleta / Recibo"
              placeholder="Ej: 001-002-00012345"
              value={expenseForm.invoiceNumber}
              onChange={(e) => setExpenseForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
            />
            <Input
              label="Fecha de Pago"
              type="date"
              value={expenseForm.paidAt}
              onChange={(e) => setExpenseForm((f) => ({ ...f, paidAt: e.target.value }))}
              required
            />
          </div>

          {/* Desglose de Montos e Impuestos */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase">💰 Desglose Económico e Impuestos</div>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Subtotal (Sin Impuesto)"
                type="number"
                step="0.01"
                min="0.01"
                value={expenseForm.subtotal}
                onChange={(e) => handleExpenseAmountChange("subtotal", e.target.value)}
                required
              />
              <Select
                label={expenseForm.currency === "USD" ? "Tasa IVA (EC)" : "Tasa IGV (PE)"}
                value={expenseForm.taxRate}
                onChange={(e) => handleExpenseAmountChange("taxRate", e.target.value)}
              >
                {expenseForm.currency === "USD" ? (
                  <>
                    <option value="15">IVA 15% (Ecuador)</option>
                    <option value="0">0% (Exento / Sin IVA)</option>
                  </>
                ) : (
                  <>
                    <option value="18">IGV 18% (Perú)</option>
                    <option value="0">0% (Exento / Sin IGV)</option>
                  </>
                )}
              </Select>
              <Input
                label="Total Factura Pagado"
                type="number"
                step="0.01"
                min="0.01"
                value={expenseForm.total}
                onChange={(e) => handleExpenseAmountChange("total", e.target.value)}
                required
              />
            </div>
            <div className="text-xs text-slate-500 flex justify-between pt-1">
              <span>Monto de Impuesto calculado: <strong>{fmtMoney(parseFloat(expenseForm.taxAmount) || 0, expenseForm.currency)}</strong></span>
              <span>Total a descontar: <strong className="text-red-700">{fmtMoney(parseFloat(expenseForm.total) || 0, expenseForm.currency)}</strong></span>
            </div>
          </div>

          {/* De dónde salió el dinero */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Forma de Pago (Origen de Fondos)"
              value={expenseForm.paymentSourceType}
              onChange={(e) => setExpenseForm((f) => ({ ...f, paymentSourceType: e.target.value as "BANK" | "CASH" }))}
            >
              <option value="BANK">🏦 Cuenta Bancaria</option>
              <option value="CASH">💵 Caja de Efectivo</option>
            </Select>

            {expenseForm.paymentSourceType === "BANK" ? (
              <Select
                label="Seleccionar Banco de Pago"
                value={expenseForm.bankAccountId}
                onChange={(e) => setExpenseForm((f) => ({ ...f, bankAccountId: e.target.value }))}
                required
              >
                {summary?.liquidity.banks.accounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.currency}) — Saldo: {fmtMoney(b.balance, b.currency)}
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                label="Seleccionar Caja de Efectivo"
                value={expenseForm.cashAccountId}
                onChange={(e) => setExpenseForm((f) => ({ ...f, cashAccountId: e.target.value }))}
                required
              >
                {summary?.liquidity.cash.accounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    Caja {c.code} ({c.country} {c.currency}) — Saldo: {fmtMoney(c.balance, c.currency)}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {/* Adjuntar Foto de Comprobante / Factura */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              📎 Foto o PDF del Comprobante / Factura (Opcional)
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => handleFileUpload(e, "expense")}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {expenseForm.receiptUrl && (
              <div className="mt-2 text-xs text-emerald-600 font-semibold flex items-center gap-1">
                ✓ Comprobante adjuntado listo para guardar.
              </div>
            )}
          </div>

          <Input
            label="Notas / Observaciones"
            placeholder="Ej: Pago realizado por transferencia #987654"
            value={expenseForm.notes}
            onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))}
          />

          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowExpenseModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={working} className="flex-1 font-bold">
              💾 Guardar y Contabilizar Gasto
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL MOVER DINERO (TRASPASO) ==================== */}
      <Modal open={showTransferModal} onClose={() => setShowTransferModal(false)} title="🔄 Traspaso de Fondos entre Cuentas Propias">
        <form onSubmit={handleSubmitTransfer} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-red-800 uppercase">📤 1. Cuenta de Salida (Origen)</span>
              <Select
                label="Tipo de Origen"
                value={transferForm.fromType}
                onChange={(e) => setTransferForm((f) => ({ ...f, fromType: e.target.value as "BANK" | "CASH" }))}
              >
                <option value="CASH">💵 Caja de Efectivo</option>
                <option value="BANK">🏦 Cuenta Bancaria</option>
              </Select>
              {transferForm.fromType === "BANK" ? (
                <Select
                  label="Banco Origen"
                  value={transferForm.fromBankAccountId}
                  onChange={(e) => setTransferForm((f) => ({ ...f, fromBankAccountId: e.target.value }))}
                >
                  {summary?.liquidity.banks.accounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.currency}) — Saldo: {fmtMoney(b.balance, b.currency)}
                    </option>
                  ))}
                </Select>
              ) : (
                <Select
                  label="Caja Origen"
                  value={transferForm.fromCashAccountId}
                  onChange={(e) => setTransferForm((f) => ({ ...f, fromCashAccountId: e.target.value }))}
                >
                  {summary?.liquidity.cash.accounts.map((c) => (
                    <option key={c.id} value={c.id}>
                      Caja {c.code} ({c.country} {c.currency}) — Saldo: {fmtMoney(c.balance, c.currency)}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-emerald-800 uppercase">📥 2. Cuenta de Entrada (Destino)</span>
              <Select
                label="Tipo de Destino"
                value={transferForm.toType}
                onChange={(e) => setTransferForm((f) => ({ ...f, toType: e.target.value as "BANK" | "CASH" }))}
              >
                <option value="BANK">🏦 Cuenta Bancaria</option>
                <option value="CASH">💵 Caja de Efectivo</option>
              </Select>
              {transferForm.toType === "BANK" ? (
                <Select
                  label="Banco Destino"
                  value={transferForm.toBankAccountId}
                  onChange={(e) => setTransferForm((f) => ({ ...f, toBankAccountId: e.target.value }))}
                >
                  {summary?.liquidity.banks.accounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.currency}) — Saldo: {fmtMoney(b.balance, b.currency)}
                    </option>
                  ))}
                </Select>
              ) : (
                <Select
                  label="Caja Destino"
                  value={transferForm.toCashAccountId}
                  onChange={(e) => setTransferForm((f) => ({ ...f, toCashAccountId: e.target.value }))}
                >
                  {summary?.liquidity.cash.accounts.map((c) => (
                    <option key={c.id} value={c.id}>
                      Caja {c.code} ({c.country} {c.currency}) — Saldo: {fmtMoney(c.balance, c.currency)}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Monto a Mover"
              type="number"
              step="0.01"
              min="0.01"
              value={transferForm.amount}
              onChange={(e) => setTransferForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
            <Select
              label="Moneda"
              value={transferForm.currency}
              onChange={(e) => setTransferForm((f) => ({ ...f, currency: e.target.value }))}
            >
              <option value="USD">USD ($ Dólares)</option>
              <option value="PEN">PEN (S/ Soles)</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="N° Operación / Papeleta de Depósito"
              placeholder="Ej: DEP-109283"
              value={transferForm.reference}
              onChange={(e) => setTransferForm((f) => ({ ...f, reference: e.target.value }))}
            />
            <Input
              label="Descripción / Motivo"
              placeholder="Ej: Depósito de recaudación del día en banco"
              value={transferForm.description}
              onChange={(e) => setTransferForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              📎 Comprobante de Depósito / Traspaso (Opcional)
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => handleFileUpload(e, "transfer")}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowTransferModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={working} className="flex-1 font-bold">
              💾 Ejecutar Traspaso
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL CAPITAL / SOCIOS ==================== */}
      <Modal open={showCapitalModal} onClose={() => setShowCapitalModal(false)} title="💵 Registrar Aporte o Retiro de Capital">
        <form onSubmit={handleSubmitCapital} className="space-y-4">
          <Select
            label="Tipo de Operación"
            value={capitalForm.type}
            onChange={(e) => setCapitalForm((f) => ({ ...f, type: e.target.value as "INJECTION" | "WITHDRAWAL" }))}
          >
            <option value="INJECTION">➕ Inyección / Aporte de Capital (Aumenta liquidez)</option>
            <option value="WITHDRAWAL">💸 Retiro de Utilidades / Dividendos (Salida a socios)</option>
          </Select>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Cuenta Afectada"
              value={capitalForm.destinationType}
              onChange={(e) => setCapitalForm((f) => ({ ...f, destinationType: e.target.value as "BANK" | "CASH" }))}
            >
              <option value="BANK">🏦 Cuenta Bancaria</option>
              <option value="CASH">💵 Caja de Efectivo</option>
            </Select>

            {capitalForm.destinationType === "BANK" ? (
              <Select
                label="Seleccionar Banco"
                value={capitalForm.bankAccountId}
                onChange={(e) => setCapitalForm((f) => ({ ...f, bankAccountId: e.target.value }))}
                required
              >
                {summary?.liquidity.banks.accounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.currency})
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                label="Seleccionar Caja"
                value={capitalForm.cashAccountId}
                onChange={(e) => setCapitalForm((f) => ({ ...f, cashAccountId: e.target.value }))}
                required
              >
                {summary?.liquidity.cash.accounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    Caja {c.code} ({c.country} {c.currency})
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Monto"
              type="number"
              step="0.01"
              min="0.01"
              value={capitalForm.amount}
              onChange={(e) => setCapitalForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
            <Select
              label="Moneda"
              value={capitalForm.currency}
              onChange={(e) => setCapitalForm((f) => ({ ...f, currency: e.target.value }))}
            >
              <option value="USD">USD ($ Dólares)</option>
              <option value="PEN">PEN (S/ Soles)</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Nombre del Socio / Aportante"
              placeholder="Ej: Daniel / Socio Principal"
              value={capitalForm.partnerName}
              onChange={(e) => setCapitalForm((f) => ({ ...f, partnerName: e.target.value }))}
            />
            <Input
              label="Concepto"
              placeholder="Ej: Fondeo de liquidez mensual"
              value={capitalForm.concept}
              onChange={(e) => setCapitalForm((f) => ({ ...f, concept: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              📎 Comprobante Bancario (Opcional)
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => handleFileUpload(e, "capital")}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCapitalModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={working} className="flex-1 font-bold">
              💾 Registrar Movimiento
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL PREVIEW COMPROBANTE / FACTURA ==================== */}
      <Modal open={!!previewReceiptUrl} onClose={() => setPreviewReceiptUrl(null)} title="📎 Comprobante / Factura Adjunta">
        <div className="p-2 flex flex-col items-center space-y-4">
          {previewReceiptUrl?.startsWith("data:application/pdf") ? (
            <iframe src={previewReceiptUrl} className="w-full h-96 rounded-lg border border-slate-200" title="PDF Comprobante" />
          ) : (
            <img src={previewReceiptUrl || ""} alt="Comprobante" className="max-w-full max-h-[75vh] object-contain rounded-lg border border-slate-200 shadow-sm" />
          )}
          <Button onClick={() => setPreviewReceiptUrl(null)} variant="secondary" className="w-full">
            Cerrar Visor
          </Button>
        </div>
      </Modal>
    </div>
  );
}

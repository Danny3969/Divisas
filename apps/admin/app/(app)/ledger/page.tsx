"use client";

import { useEffect, useState, useMemo } from "react";
import { Alert, Badge, Button, Card, Input, Modal, Select, Spinner } from "@/components/ui";
import { get, post, put, del } from "@/lib/api";
import { fmtDate, fmtMoney } from "@/lib/format";
import type {
  FinancialSummary,
  Expense,
  AccountTransferRecord,
  CapitalMovementRecord,
  LedgerAccount,
  LedgerEntry,
  Supplier,
  Employee,
  PayrollPayment,
  BankStatement,
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
  const [activeTab, setActiveTab] = useState<
    "summary" | "banks" | "expenses" | "suppliers" | "employees" | "transfers" | "ledger"
  >("summary");

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollPayments, setPayrollPayments] = useState<PayrollPayment[]>([]);
  const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);
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
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showBankMovementModal, setShowBankMovementModal] = useState(false);
  const [showBankStatementModal, setShowBankStatementModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  // Formulario Reset / Saldos Iniciales Reales
  const [resetForm, setResetForm] = useState({
    pichinchaBalanceUsd: "5000",
    cashEcBalanceUsd: "2000",
    bcpBalancePen: "18000",
    cashPeBalancePen: "5000",
    partnerName: "Socio Principal",
    notes: "Apertura contable y saldos reales iniciales",
  });

  // Formulario Gasto / Factura
  const [expenseForm, setExpenseForm] = useState({
    category: "UTILITIES",
    supplierId: "",
    supplierName: "",
    supplierTaxId: "",
    invoiceNumber: "",
    currency: "USD",
    subtotal: "100",
    taxRate: "15",
    taxAmount: "15",
    total: "115",
    paymentSourceType: "BANK" as "BANK" | "CASH",
    bankAccountId: "",
    cashAccountId: "",
    paidAt: new Date().toISOString().split("T")[0],
    receiptUrl: "",
    notes: "",
  });

  // Formulario Proveedor
  const [supplierForm, setSupplierForm] = useState({
    id: "",
    name: "",
    taxId: "",
    countryCode: "EC",
    category: "UTILITIES",
    phone: "",
    email: "",
    address: "",
    bankName: "Banco Pichincha",
    bankAccountNumber: "",
    notes: "",
  });

  // Formulario Empleado
  const [employeeForm, setEmployeeForm] = useState({
    id: "",
    fullName: "",
    documentType: "CEDULA" as "CEDULA" | "DNI" | "PASSPORT" | "RUC",
    documentNumber: "",
    countryCode: "EC",
    position: "Cajero de Agencia",
    baseSalary: "500",
    salaryCurrency: "USD",
    paymentFrequency: "MONTHLY",
    bankName: "Banco Pichincha",
    bankAccountNumber: "",
    phone: "",
    email: "",
  });

  // Formulario Pago de Nómina
  const [payrollForm, setPayrollForm] = useState({
    employeeId: "",
    amount: "500",
    currency: "USD",
    period: `${new Intl.DateTimeFormat("es-ES", { month: "long" }).format(new Date())} ${new Date().getFullYear()}`,
    paymentSourceType: "BANK" as "BANK" | "CASH",
    bankAccountId: "",
    cashAccountId: "",
    receiptUrl: "",
    notes: "",
  });

  // Formulario Movimiento Bancario Directo
  const [bankMovementForm, setBankMovementForm] = useState({
    bankAccountId: "",
    type: "DEPOSIT" as "DEPOSIT" | "WITHDRAWAL",
    amount: "1000",
    currency: "USD",
    reference: "",
    description: "",
    receiptUrl: "",
  });

  // Formulario Carga de Extracto Bancario
  const [statementForm, setStatementForm] = useState({
    bankAccountId: "",
    fileName: "",
    rawCsvText: "",
    parsedLines: [] as { date: string; description: string; reference?: string; amount: number; type: "DEPOSIT" | "WITHDRAWAL" }[],
  });

  // Formulario Traspaso entre Cuentas
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
    concept: "Aporte de liquidez",
    receiptUrl: "",
  });

  // Filtros
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("");
  const [expenseCurrencyFilter, setExpenseCurrencyFilter] = useState("");

  const loadAllData = async () => {
    try {
      const [sum, exp, sup, emp, pay, stm, trf, cap, accs, ents] = await Promise.all([
        get<FinancialSummary>("/accounting/summary"),
        get<Expense[]>("/accounting/expenses"),
        get<Supplier[]>("/accounting/suppliers"),
        get<Employee[]>("/accounting/employees"),
        get<PayrollPayment[]>("/accounting/payroll/history"),
        get<BankStatement[]>("/accounting/bank-statements"),
        get<AccountTransferRecord[]>("/accounting/account-transfers"),
        get<CapitalMovementRecord[]>("/accounting/capital-movements"),
        get<LedgerAccount[]>("/ledger/accounts"),
        get<LedgerEntry[]>("/ledger/entries?limit=150"),
      ]);

      setSummary(sum);
      setExpenses(exp);
      setSuppliers(sup);
      setEmployees(emp);
      setPayrollPayments(pay);
      setBankStatements(stm);
      setAccountTransfers(trf);
      setCapitalMovements(cap);
      setLedgerAccounts(accs);
      setLedgerEntries(ents);

      if (sum.liquidity.banks.accounts.length > 0) {
        const b = sum.liquidity.banks.accounts[0];
        if (!expenseForm.bankAccountId) setExpenseForm((f) => ({ ...f, bankAccountId: b.id }));
        if (!transferForm.toBankAccountId) setTransferForm((f) => ({ ...f, toBankAccountId: b.id }));
        if (!capitalForm.bankAccountId) setCapitalForm((f) => ({ ...f, bankAccountId: b.id }));
        if (!bankMovementForm.bankAccountId) setBankMovementForm((f) => ({ ...f, bankAccountId: b.id }));
        if (!statementForm.bankAccountId) setStatementForm((f) => ({ ...f, bankAccountId: b.id }));
        if (!payrollForm.bankAccountId) setPayrollForm((f) => ({ ...f, bankAccountId: b.id }));
      }
      if (sum.liquidity.cash.accounts.length > 0) {
        const c = sum.liquidity.cash.accounts[0];
        if (!expenseForm.cashAccountId) setExpenseForm((f) => ({ ...f, cashAccountId: c.id }));
        if (!transferForm.fromCashAccountId) setTransferForm((f) => ({ ...f, fromCashAccountId: c.id }));
        if (!capitalForm.cashAccountId) setCapitalForm((f) => ({ ...f, cashAccountId: c.id }));
        if (!payrollForm.cashAccountId) setPayrollForm((f) => ({ ...f, cashAccountId: c.id }));
      }
      if (emp.length > 0 && !payrollForm.employeeId) {
        setPayrollForm((f) => ({
          ...f,
          employeeId: emp[0].id,
          amount: String(emp[0].baseSalary),
          currency: emp[0].salaryCurrency,
        }));
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

  // Seleccionar proveedor en formulario de gasto
  const handleSelectSupplierInExpense = (supId: string) => {
    if (!supId) {
      setExpenseForm((f) => ({ ...f, supplierId: "", supplierName: "", supplierTaxId: "" }));
      return;
    }
    const s = suppliers.find((x) => x.id === supId);
    if (s) {
      setExpenseForm((f) => ({
        ...f,
        supplierId: s.id,
        supplierName: s.name,
        supplierTaxId: s.taxId || "",
        category: s.category || f.category,
      }));
    }
  };

  // Manejador para adjuntar foto / archivo en Base64
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("El archivo es demasiado grande (máximo 5MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Parsear archivo CSV de extracto bancario
  const handleStatementFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatementForm((f) => ({ ...f, fileName: file.name }));

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const parsed: { date: string; description: string; reference?: string; amount: number; type: "DEPOSIT" | "WITHDRAWAL" }[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && (line.toLowerCase().includes("fecha") || line.toLowerCase().includes("monto") || line.toLowerCase().includes("date"))) {
          continue; // Saltear cabecera
        }
        const cols = line.split(/[,;\t]/).map((c) => c.replace(/^["']|["']$/g, "").trim());
        if (cols.length >= 3) {
          const dateStr = cols[0];
          const desc = cols[1];
          const amtStr = cols[2].replace(/[^\d.-]/g, "");
          const amt = parseFloat(amtStr) || 0;
          const ref = cols[3] || undefined;
          const type = amt >= 0 ? "DEPOSIT" : "WITHDRAWAL";
          if (amt !== 0) {
            parsed.push({
              date: new Date(dateStr).toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
              description: desc,
              reference: ref,
              amount: Math.abs(amt),
              type,
            });
          }
        }
      }

      setStatementForm((f) => ({ ...f, rawCsvText: text, parsedLines: parsed }));
    };
    reader.readAsText(file);
  };

  // ==================== SUBMIT HANDLERS ====================

  // Reset Inicial de Contabilidad
  const handleResetInitialData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm("⚠️ ¿Estás seguro de reiniciar la contabilidad? Se eliminarán las operaciones de prueba y se fijarán tus saldos iniciales reales de apertura.")) return;
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      const res = await post<{ success: boolean; message: string }>("/accounting/reset-initial-data", {
        pichinchaBalanceUsd: parseFloat(resetForm.pichinchaBalanceUsd) || 0,
        cashEcBalanceUsd: parseFloat(resetForm.cashEcBalanceUsd) || 0,
        bcpBalancePen: parseFloat(resetForm.bcpBalancePen) || 0,
        cashPeBalancePen: parseFloat(resetForm.cashPeBalancePen) || 0,
        partnerName: resetForm.partnerName || "Socio",
        notes: resetForm.notes,
      });
      setSuccess("✓ " + res.message);
      setShowResetModal(false);
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reiniciar contabilidad");
    } finally {
      setWorking(false);
    }
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
        supplierId: expenseForm.supplierId || undefined,
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
      setSuccess("¡Gasto registrado exitosamente con asiento contable y descuento de saldo!");
      setShowExpenseModal(false);
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el gasto");
    } finally {
      setWorking(false);
    }
  };

  // Crear Proveedor
  const handleSubmitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      if (supplierForm.id) {
        await put(`/accounting/suppliers/${supplierForm.id}`, supplierForm);
        setSuccess("Proveedor actualizado con éxito.");
      } else {
        await post("/accounting/suppliers", supplierForm);
        setSuccess("Proveedor registrado exitosamente.");
      }
      setShowSupplierModal(false);
      setSupplierForm({ id: "", name: "", taxId: "", countryCode: "EC", category: "UTILITIES", phone: "", email: "", address: "", bankName: "Banco Pichincha", bankAccountNumber: "", notes: "" });
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar proveedor");
    } finally {
      setWorking(false);
    }
  };

  // Crear Empleado
  const handleSubmitEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      if (employeeForm.id) {
        await put(`/accounting/employees/${employeeForm.id}`, {
          ...employeeForm,
          baseSalary: parseFloat(employeeForm.baseSalary),
        });
        setSuccess("Trabajador actualizado exitosamente.");
      } else {
        await post("/accounting/employees", {
          ...employeeForm,
          baseSalary: parseFloat(employeeForm.baseSalary),
        });
        setSuccess("Trabajador registrado en la nómina exitosamente.");
      }
      setShowEmployeeModal(false);
      setEmployeeForm({ id: "", fullName: "", documentType: "CEDULA", documentNumber: "", countryCode: "EC", position: "Cajero de Agencia", baseSalary: "500", salaryCurrency: "USD", paymentFrequency: "MONTHLY", bankName: "Banco Pichincha", bankAccountNumber: "", phone: "", email: "" });
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar trabajador");
    } finally {
      setWorking(false);
    }
  };

  // Pagar Nómina
  const handleSubmitPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      await post("/accounting/payroll/pay", {
        employeeId: payrollForm.employeeId,
        amount: parseFloat(payrollForm.amount),
        currency: payrollForm.currency,
        period: payrollForm.period,
        paymentSourceType: payrollForm.paymentSourceType,
        bankAccountId: payrollForm.paymentSourceType === "BANK" ? payrollForm.bankAccountId : undefined,
        cashAccountId: payrollForm.paymentSourceType === "CASH" ? payrollForm.cashAccountId : undefined,
        receiptUrl: payrollForm.receiptUrl || undefined,
        notes: payrollForm.notes || undefined,
      });
      setSuccess("¡Sueldo pagado con éxito! Se descontó de la cuenta y se generó el asiento en Sueldos y Nómina.");
      setShowPayrollModal(false);
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al pagar nómina");
    } finally {
      setWorking(false);
    }
  };

  // Movimiento Bancario Directo (Depósito o Retiro)
  const handleSubmitBankMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      await post("/accounting/bank-movements", {
        bankAccountId: bankMovementForm.bankAccountId,
        type: bankMovementForm.type,
        amount: parseFloat(bankMovementForm.amount),
        currency: bankMovementForm.currency,
        reference: bankMovementForm.reference || undefined,
        description: bankMovementForm.description || undefined,
        receiptUrl: bankMovementForm.receiptUrl || undefined,
      });
      setSuccess(`¡${bankMovementForm.type === "DEPOSIT" ? "Depósito" : "Retiro"} bancario registrado exitosamente!`);
      setShowBankMovementModal(false);
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar movimiento bancario");
    } finally {
      setWorking(false);
    }
  };

  // Subir Extracto Bancario
  const handleSubmitBankStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (statementForm.parsedLines.length === 0) {
      alert("Por favor selecciona un archivo CSV válido con movimientos bancarios.");
      return;
    }
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      await post("/accounting/bank-statements/upload", {
        bankAccountId: statementForm.bankAccountId,
        fileName: statementForm.fileName || "extracto_bancario.csv",
        lines: statementForm.parsedLines,
      });
      setSuccess("¡Extracto bancario cargado exitosamente! Ahora puedes conciliar cada transacción.");
      setShowBankStatementModal(false);
      setStatementForm((f) => ({ ...f, fileName: "", rawCsvText: "", parsedLines: [] }));
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir extracto");
    } finally {
      setWorking(false);
    }
  };

  // Conciliar Línea de Extracto Bancario
  const handleMatchStatementLine = async (lineId: string, action: "MATCH" | "CREATE_EXPENSE" | "IGNORE") => {
    setWorking(true);
    try {
      await post("/accounting/bank-statements/match", {
        lineId,
        action,
      });
      setSuccess("Línea bancaria procesada correctamente.");
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conciliar");
    } finally {
      setWorking(false);
    }
  };

  // Traspaso
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
      setSuccess("¡Traspaso entre cuentas ejecutado con éxito!");
      setShowTransferModal(false);
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al transferir fondos");
    } finally {
      setWorking(false);
    }
  };

  // Movimiento de Capital
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

  // Exportar a CSV
  const exportLedgerToCsv = () => {
    const headers = ["Fecha", "Grupo Asiento", "Cuenta Código", "Cuenta Nombre", "Lado", "Monto", "Moneda", "Descripción"];
    const rows = ledgerEntries.map((e) => [
      new Date(e.createdAt).toISOString(),
      e.entryGroup || "—",
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
    link.setAttribute("download", `Libro_Contable_VALEX_${new Date().toISOString().split("T")[0]}.csv`);
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
      {/* Header con Acciones Principales */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Módulo Contable & Tesorería Empresarial
            </h1>
            <Badge className="bg-emerald-100 text-emerald-800 font-bold text-xs">Pichincha USD & BCP PEN</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestión integral de cuentas bancarias oficiales, fondeo de cajas, proveedores, nómina y conciliación de extractos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowResetModal(true)} variant="secondary" className="text-xs font-bold border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100">
            ⚙️ Configurar Saldos Reales Iniciales
          </Button>
          <Button onClick={() => setShowBankMovementModal(true)} variant="secondary" className="text-xs font-bold">
            🏦 Depósito / Retiro Banco
          </Button>
          <Button onClick={() => setShowExpenseModal(true)} variant="primary" className="text-xs font-bold shadow-sm">
            ➕ Registrar Gasto / Factura
          </Button>
          <Button onClick={() => setShowPayrollModal(true)} variant="secondary" className="text-xs font-bold bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100">
            💸 Pagar Nómina
          </Button>
        </div>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      {/* Tabs de Navegación */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-2 pt-2 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "summary"
              ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          📈 Resumen & Estado P&L
        </button>
        <button
          onClick={() => setActiveTab("banks")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "banks"
              ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          🏦 Bancos & Conciliación ({bankStatements.length})
        </button>
        <button
          onClick={() => setActiveTab("expenses")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "expenses"
              ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          🧾 Facturas y Gastos ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab("suppliers")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "suppliers"
              ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          🏢 Proveedores ({suppliers.length})
        </button>
        <button
          onClick={() => setActiveTab("employees")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "employees"
              ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          👥 Personal & Nómina ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab("transfers")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "transfers"
              ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          🔄 Traspasos & Capital
        </button>
        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
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
          {/* Tarjetas Principales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-emerald-500">
              <div className="text-xs font-bold text-slate-500 uppercase">🇪🇨 Liquidez Total Ecuador (USD)</div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {fmtMoney(summary.liquidity.totalUsd, "USD")}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex justify-between font-mono">
                <span>Pichincha: {fmtMoney(summary.liquidity.banks.totalUsd, "USD")}</span>
                <span>Caja: {fmtMoney(summary.liquidity.cash.totalUsd, "USD")}</span>
              </div>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <div className="text-xs font-bold text-slate-500 uppercase">🇵🇪 Liquidez Total Perú (PEN)</div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {fmtMoney(summary.liquidity.totalPen, "PEN")}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex justify-between font-mono">
                <span>BCP: {fmtMoney(summary.liquidity.banks.totalPen, "PEN")}</span>
                <span>Caja: {fmtMoney(summary.liquidity.cash.totalPen, "PEN")}</span>
              </div>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <div className="text-xs font-bold text-slate-500 uppercase">Ganancia Neta (USD)</div>
              <div className={`text-2xl font-black mt-1 ${summary.pnl.netProfit.usd >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {fmtMoney(summary.pnl.netProfit.usd, "USD")}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Ingresos: {fmtMoney(summary.pnl.revenue.totalRevenueUsd, "USD")} | Gastos: {fmtMoney(summary.pnl.expenses.totalUsd, "USD")}
              </div>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <div className="text-xs font-bold text-slate-500 uppercase">Ganancia Neta (PEN)</div>
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
            <Card title="🏦 Cuentas Bancarias Principales">
              <div className="space-y-3">
                {summary.liquidity.banks.accounts.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 transition-colors">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        {b.name}
                        <Badge className="bg-slate-200 text-slate-800 font-mono text-[10px] font-bold">{b.currency}</Badge>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">N° {b.accountNumber} · {b.country}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-slate-900">{fmtMoney(b.balance, b.currency)}</div>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ● Operando en vivo
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="💵 Cajas Físicas de Efectivo en Agencias">
              <div className="space-y-3">
                {summary.liquidity.cash.accounts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 transition-colors">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        Caja Efectivo {c.code}
                        <Badge className={c.currency === "USD" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>
                          {c.country} ({c.currency})
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">Dinero disponible en ventanilla</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-slate-900">{fmtMoney(c.balance, c.currency)}</div>
                      <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        ● Caja Abierta
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Estado de Resultados P&L */}
          <Card title="📊 Estado de Resultados (P&L — Ganancias vs Gastos)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 border-r-0 md:border-r border-slate-200 md:pr-4">
                <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                  🟢 1. Ingresos Operativos
                </h3>
                <div className="p-3.5 bg-emerald-50/50 rounded-xl space-y-2 text-sm border border-emerald-100">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Comisiones de Giros (USD):</span>
                    <span className="font-bold text-slate-900">{fmtMoney(summary.pnl.revenue.feesUsd, "USD")}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Comisiones de Giros (PEN):</span>
                    <span className="font-bold text-slate-900">{fmtMoney(summary.pnl.revenue.feesPen, "PEN")}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Margen por Spread Cambiario (FX):</span>
                    <span className="font-bold text-slate-900">{fmtMoney(summary.pnl.revenue.fxProfitUsd, "USD")}</span>
                  </div>
                  <div className="border-t border-emerald-200 pt-2 flex justify-between font-black text-emerald-900 text-sm">
                    <span>Total Ingresos Generados:</span>
                    <span>{fmtMoney(summary.pnl.revenue.totalRevenueUsd, "USD")}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-red-800 uppercase tracking-wide flex items-center gap-1.5">
                  🔴 2. Gastos Operativos y Facturas
                </h3>
                <div className="p-3.5 bg-red-50/50 rounded-xl space-y-2 text-sm border border-red-100">
                  {Object.keys(summary.pnl.expenses.byCategory).length === 0 ? (
                    <div className="text-xs text-slate-400 py-4 text-center">Sin gastos registrados.</div>
                  ) : (
                    Object.entries(summary.pnl.expenses.byCategory).map(([cat, data]) => {
                      const meta = CATEGORY_NAMES[cat] || { label: cat, icon: "🏷️" };
                      return (
                        <div key={cat} className="flex justify-between text-xs">
                          <span className="text-slate-700 flex items-center gap-1">
                            <span>{meta.icon}</span> {meta.label} ({data.count}):
                          </span>
                          <span className="font-semibold text-slate-900 font-mono">
                            {data.totalUsd > 0 && fmtMoney(data.totalUsd, "USD")}
                            {data.totalUsd > 0 && data.totalPen > 0 && " + "}
                            {data.totalPen > 0 && fmtMoney(data.totalPen, "PEN")}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div className="border-t border-red-200 pt-2 flex justify-between font-black text-red-900 text-sm">
                    <span>Total Gastos ({summary.pnl.expenses.count}):</span>
                    <span>{fmtMoney(summary.pnl.expenses.totalUsd, "USD")}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ==================== TAB 2: BANCOS Y CONCILIACIÓN ==================== */}
      {activeTab === "banks" && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                🏦 Cuentas Bancarias y Conciliación Inteligente
              </h2>
              <p className="text-xs text-slate-500">
                Monitorea los movimientos bancarios, registra depósitos/retiros y sube extractos en CSV/Excel para conciliar.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowBankMovementModal(true)} variant="primary" className="text-xs font-bold">
                ➕ Registrar Depósito / Retiro
              </Button>
              <Button onClick={() => setShowBankStatementModal(true)} variant="secondary" className="text-xs font-bold">
                📑 Importar Extracto CSV/Excel
              </Button>
            </div>
          </div>

          {/* Extractos Cargados y Conciliación */}
          <Card title={`📑 Extractos Bancarios Importados (${bankStatements.length})`}>
            {bankStatements.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <div>No se ha importado ningún extracto bancario todavía.</div>
                <Button onClick={() => setShowBankStatementModal(true)} variant="secondary" className="text-xs">
                  Importar Extracto de Banco Pichincha o BCP
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {bankStatements.map((stm) => (
                  <div key={stm.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-2 border-b border-slate-200 pb-3">
                      <div>
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          📄 {stm.fileName}
                          <Badge className="bg-slate-200 text-slate-800">{stm.bankAccount?.bankName}</Badge>
                          <Badge
                            className={
                              stm.status === "RECONCILED"
                                ? "bg-emerald-100 text-emerald-800"
                                : stm.status === "PARTIALLY_MATCHED"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }
                          >
                            {stm.status === "RECONCILED" ? "✓ Conciliado al 100%" : `${stm.matchedCount}/${stm.linesCount} Conciliados`}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Subido el {fmtDate(stm.uploadedAt)} · Total Depósitos: {fmtMoney(stm.totalDeposits, stm.bankAccount?.currency || "USD")} | Total Retiros: {fmtMoney(stm.totalWithdrawals, stm.bankAccount?.currency || "USD")}
                        </div>
                      </div>
                    </div>

                    {/* Líneas del Extracto */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 bg-white">
                            <th className="py-2 px-2">Fecha</th>
                            <th className="py-2 px-2">Descripción Bancaria</th>
                            <th className="py-2 px-2">Referencia</th>
                            <th className="py-2 px-2">Tipo</th>
                            <th className="py-2 px-2 text-right">Monto</th>
                            <th className="py-2 px-2 text-center">Estado</th>
                            <th className="py-2 px-2 text-center">Acción de Conciliación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stm.lines?.map((line) => (
                            <tr key={line.id} className="border-b border-slate-100 hover:bg-white">
                              <td className="py-2 px-2 text-slate-600">{fmtDate(line.date)}</td>
                              <td className="py-2 px-2 font-medium text-slate-900">{line.description}</td>
                              <td className="py-2 px-2 font-mono text-slate-500">{line.reference || "—"}</td>
                              <td className="py-2 px-2">
                                <Badge className={line.type === "DEPOSIT" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                                  {line.type === "DEPOSIT" ? "Depósito (+)" : "Retiro (-)"}
                                </Badge>
                              </td>
                              <td className="py-2 px-2 text-right font-bold text-slate-900">
                                {fmtMoney(line.amount, stm.bankAccount?.currency || "USD")}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {line.matched ? (
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    ✓ Conciliado ({line.matchedRef})
                                  </span>
                                ) : (
                                  <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    Pendiente
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-center space-x-1">
                                {!line.matched && (
                                  <>
                                    <button
                                      onClick={() => handleMatchStatementLine(line.id, "MATCH")}
                                      disabled={working}
                                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px]"
                                    >
                                      ✓ Marcar Conciliado
                                    </button>
                                    {line.type === "WITHDRAWAL" && (
                                      <button
                                        onClick={() => handleMatchStatementLine(line.id, "CREATE_EXPENSE")}
                                        disabled={working}
                                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px]"
                                      >
                                        ➕ Crear Gasto
                                      </button>
                                    )}
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ==================== TAB 3: GASTOS Y FACTURAS ==================== */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div className="w-full md:w-80">
              <Input
                placeholder="🔍 Buscar proveedor, RUC, factura o código..."
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
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 bg-slate-50">
                    <th className="py-3 px-3">Código</th>
                    <th className="py-3 px-3">Fecha</th>
                    <th className="py-3 px-3">Proveedor / Beneficiario</th>
                    <th className="py-3 px-3">Categoría</th>
                    <th className="py-3 px-3">N° Factura</th>
                    <th className="py-3 px-3 text-right">Subtotal</th>
                    <th className="py-3 px-3 text-right">Impuesto</th>
                    <th className="py-3 px-3 text-right">Total</th>
                    <th className="py-3 px-3">Cuenta Origen</th>
                    <th className="py-3 px-3 text-center">Comprobante</th>
                    <th className="py-3 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-slate-400">
                        No se encontraron gastos registrados con los filtros aplicados.
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
                        <tr key={exp.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-3 font-mono font-bold text-blue-700">{exp.expenseNumber}</td>
                          <td className="py-3 px-3 text-slate-600">{fmtDate(exp.paidAt)}</td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{exp.supplierName}</div>
                            {exp.supplierTaxId && (
                              <div className="text-[10px] text-slate-400 font-mono">RUC/CI: {exp.supplierTaxId}</div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <Badge className="bg-slate-100 text-slate-800 text-[11px] font-semibold">
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
                          <td className="py-3 px-3 text-right font-black text-slate-900">{fmtMoney(exp.total, exp.currency)}</td>
                          <td className="py-3 px-3 font-medium text-slate-700">{accountLabel}</td>
                          <td className="py-3 px-3 text-center">
                            {exp.receiptUrl ? (
                              <button
                                onClick={() => setPreviewReceiptUrl(exp.receiptUrl!)}
                                className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded font-bold"
                              >
                                📎 Ver Foto
                              </button>
                            ) : (
                              <span className="text-slate-300 text-[10px]">Sin archivo</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={async () => {
                                if (confirm(`¿Eliminar gasto ${exp.expenseNumber}? El saldo se devolverá a la cuenta.`)) {
                                  await del(`/accounting/expenses/${exp.id}`);
                                  loadAllData();
                                }
                              }}
                              className="text-red-500 hover:text-red-700 p-1 font-bold"
                              title="Eliminar gasto"
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

      {/* ==================== TAB 4: PROVEEDORES ==================== */}
      {activeTab === "suppliers" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">🏢 Directorio de Proveedores Registrados</h2>
              <p className="text-xs text-slate-500">Mantén los datos fiscales y bancarios de tus proveedores para auto-completar facturas.</p>
            </div>
            <Button
              onClick={() => {
                setSupplierForm({ id: "", name: "", taxId: "", countryCode: "EC", category: "UTILITIES", phone: "", email: "", address: "", bankName: "Banco Pichincha", bankAccountNumber: "", notes: "" });
                setShowSupplierModal(true);
              }}
              variant="primary"
              className="text-xs font-bold"
            >
              ➕ Nuevo Proveedor
            </Button>
          </div>

          <Card title={`Lista de Proveedores (${suppliers.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 bg-slate-50">
                    <th className="py-2.5 px-3">Razón Social / Proveedor</th>
                    <th className="py-2.5 px-3">RUC / CI / DNI</th>
                    <th className="py-2.5 px-3">País</th>
                    <th className="py-2.5 px-3">Categoría Habitual</th>
                    <th className="py-2.5 px-3">Contacto</th>
                    <th className="py-2.5 px-3">Cuenta Bancaria</th>
                    <th className="py-2.5 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        No hay proveedores registrados. Haz clic en "➕ Nuevo Proveedor" para crear uno.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((s) => (
                      <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{s.name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{s.taxId || "—"}</td>
                        <td className="py-2.5 px-3">
                          <Badge className={s.country?.code === "EC" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>
                            {s.country?.name || s.countryId}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge className="bg-slate-100 text-slate-800">{CATEGORY_NAMES[s.category]?.label || s.category}</Badge>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{s.phone || s.email || "—"}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {s.bankName ? `${s.bankName} (${s.bankAccountNumber || "—"})` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center space-x-2">
                          <button
                            onClick={() => {
                              setSupplierForm({
                                id: s.id,
                                name: s.name,
                                taxId: s.taxId || "",
                                countryCode: s.country?.code || "EC",
                                category: s.category || "UTILITIES",
                                phone: s.phone || "",
                                email: s.email || "",
                                address: s.address || "",
                                bankName: s.bankName || "Banco Pichincha",
                                bankAccountNumber: s.bankAccountNumber || "",
                                notes: s.notes || "",
                              });
                              setShowSupplierModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`¿Desactivar proveedor ${s.name}?`)) {
                                await del(`/accounting/suppliers/${s.id}`);
                                loadAllData();
                              }
                            }}
                            className="text-red-500 hover:text-red-700 font-semibold"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ==================== TAB 5: PERSONAL Y NÓMINA ==================== */}
      {activeTab === "employees" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">👥 Trabajadores y Nómina de Sueldos</h2>
              <p className="text-xs text-slate-500">Registra el personal, salarios y liquida sus pagos con un clic.</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setEmployeeForm({ id: "", fullName: "", documentType: "CEDULA", documentNumber: "", countryCode: "EC", position: "Cajero de Agencia", baseSalary: "500", salaryCurrency: "USD", paymentFrequency: "MONTHLY", bankName: "Banco Pichincha", bankAccountNumber: "", phone: "", email: "" });
                  setShowEmployeeModal(true);
                }}
                variant="secondary"
                className="text-xs font-bold"
              >
                ➕ Nuevo Trabajador
              </Button>
              <Button onClick={() => setShowPayrollModal(true)} variant="primary" className="text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white">
                💸 Pagar Sueldo / Nómina
              </Button>
            </div>
          </div>

          {/* Lista de Empleados */}
          <Card title={`Personal Activo (${employees.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 bg-slate-50">
                    <th className="py-2.5 px-3">Nombre Completo</th>
                    <th className="py-2.5 px-3">Documento</th>
                    <th className="py-2.5 px-3">Cargo / Puesto</th>
                    <th className="py-2.5 px-3">País</th>
                    <th className="py-2.5 px-3 text-right">Sueldo Base</th>
                    <th className="py-2.5 px-3">Cuenta de Depósito</th>
                    <th className="py-2.5 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        No hay trabajadores registrados. Usa el botón "➕ Nuevo Trabajador".
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => (
                      <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{emp.fullName}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{emp.documentType}: {emp.documentNumber}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{emp.position}</td>
                        <td className="py-2.5 px-3">
                          <Badge className={emp.country?.code === "EC" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>
                            {emp.country?.name || emp.countryId}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          {fmtMoney(emp.baseSalary, emp.salaryCurrency)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {emp.bankName ? `${emp.bankName} (${emp.bankAccountNumber || "—"})` : "Efectivo"}
                        </td>
                        <td className="py-2.5 px-3 text-center space-x-2">
                          <button
                            onClick={() => {
                              setPayrollForm((f) => ({
                                ...f,
                                employeeId: emp.id,
                                amount: String(emp.baseSalary),
                                currency: emp.salaryCurrency,
                              }));
                              setShowPayrollModal(true);
                            }}
                            className="text-purple-700 hover:text-purple-900 font-bold bg-purple-50 px-2 py-1 rounded"
                          >
                            💸 Pagar
                          </button>
                          <button
                            onClick={() => {
                              setEmployeeForm({
                                id: emp.id,
                                fullName: emp.fullName,
                                documentType: emp.documentType as any,
                                documentNumber: emp.documentNumber,
                                countryCode: emp.country?.code || "EC",
                                position: emp.position,
                                baseSalary: String(emp.baseSalary),
                                salaryCurrency: emp.salaryCurrency,
                                paymentFrequency: emp.paymentFrequency || "MONTHLY",
                                bankName: emp.bankName || "Banco Pichincha",
                                bankAccountNumber: emp.bankAccountNumber || "",
                                phone: emp.phone || "",
                                email: emp.email || "",
                              });
                              setShowEmployeeModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            ✏️ Editar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Historial de Pagos de Nómina */}
          <Card title={`Historial de Liquidaciones y Pagos de Nómina (${payrollPayments.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 bg-slate-50">
                    <th className="py-2.5 px-3">N° Pago</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Trabajador</th>
                    <th className="py-2.5 px-3">Periodo</th>
                    <th className="py-2.5 px-3">Cuenta Origen</th>
                    <th className="py-2.5 px-3 text-right">Monto Pagado</th>
                    <th className="py-2.5 px-3 text-center">Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No hay pagos de nómina registrados.
                      </td>
                    </tr>
                  ) : (
                    payrollPayments.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-purple-700">{p.payrollNumber}</td>
                        <td className="py-2.5 px-3 text-slate-600">{fmtDate(p.paidAt)}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{p.employee?.fullName}</td>
                        <td className="py-2.5 px-3 text-slate-700">{p.period}</td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {p.paymentSourceType === "BANK" ? `🏦 ${p.bankAccount?.bankName ?? "Banco"}` : `💵 Caja ${p.cashAccount?.code ?? "Efectivo"}`}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">{fmtMoney(p.amount, p.currency)}</td>
                        <td className="py-2.5 px-3 text-center">
                          {p.receiptUrl ? (
                            <button
                              onClick={() => setPreviewReceiptUrl(p.receiptUrl!)}
                              className="text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 px-2 py-0.5 rounded font-bold"
                            >
                              📎 Ver
                            </button>
                          ) : (
                            <span className="text-slate-300">Sin archivo</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ==================== TAB 6: TRASPASOS Y CAPITAL ==================== */}
      {activeTab === "transfers" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">🔄 Fondeo de Cajas y Movimientos de Socios</h2>
              <p className="text-xs text-slate-500">Mueve fondos entre banco y caja, o registra aportes/retiros de capital.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowTransferModal(true)} variant="primary" className="text-xs font-bold">
                🔄 Mover Dinero (Banco ↔ Caja)
              </Button>
              <Button onClick={() => setShowCapitalModal(true)} variant="secondary" className="text-xs font-bold">
                💵 Aporte / Retiro Socio
              </Button>
            </div>
          </div>

          <Card title={`Traspasos Internos Registrados (${accountTransfers.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 bg-slate-50">
                    <th className="py-2.5 px-3">N° Traspaso</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Origen</th>
                    <th className="py-2.5 px-3">Destino</th>
                    <th className="py-2.5 px-3 text-right">Monto</th>
                    <th className="py-2.5 px-3">Referencia</th>
                    <th className="py-2.5 px-3">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {accountTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">Sin traspasos registrados.</td>
                    </tr>
                  ) : (
                    accountTransfers.map((trf) => (
                      <tr key={trf.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{trf.transferNumber}</td>
                        <td className="py-2.5 px-3 text-slate-600">{fmtDate(trf.transferredAt)}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {trf.fromType === "BANK" ? `🏦 ${trf.fromBankAccount?.bankName ?? "Banco"}` : `💵 Caja ${trf.fromCashAccount?.code ?? "Efectivo"}`}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-800">
                          {trf.toType === "BANK" ? `🏦 ${trf.toBankAccount?.bankName ?? "Banco"}` : `💵 Caja ${trf.toCashAccount?.code ?? "Efectivo"}`}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">{fmtMoney(trf.amount, trf.currency)}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{trf.reference || "—"}</td>
                        <td className="py-2.5 px-3 text-slate-600">{trf.description || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={`Movimientos de Capital Social y Dividendos (${capitalMovements.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 bg-slate-50">
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Socio</th>
                    <th className="py-2.5 px-3">Cuenta</th>
                    <th className="py-2.5 px-3 text-right">Monto</th>
                    <th className="py-2.5 px-3">Concepto</th>
                  </tr>
                </thead>
                <tbody>
                  {capitalMovements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">Sin movimientos de capital.</td>
                    </tr>
                  ) : (
                    capitalMovements.map((cap) => (
                      <tr key={cap.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{cap.movementNumber}</td>
                        <td className="py-2.5 px-3 text-slate-600">{fmtDate(cap.createdAt)}</td>
                        <td className="py-2.5 px-3">
                          <Badge className={cap.type === "INJECTION" ? "bg-emerald-100 text-emerald-800" : "bg-purple-100 text-purple-800"}>
                            {cap.type === "INJECTION" ? "➕ Aporte Capital" : "💸 Retiro Utilidad"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{cap.partnerName || "Socio"}</td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {cap.destinationType === "BANK" ? `🏦 ${cap.bankAccount?.bankName ?? "Banco"}` : `💵 Caja ${cap.cashAccount?.code ?? "Efectivo"}`}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">{fmtMoney(cap.amount, cap.currency)}</td>
                        <td className="py-2.5 px-3 text-slate-600">{cap.concept || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ==================== TAB 7: LIBRO CONTABLE ==================== */}
      {activeTab === "ledger" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">📚 Plan de Cuentas y Libro Diario General</h2>
              <p className="text-xs text-slate-500">Asientos automáticos de partida doble matemática auditables.</p>
            </div>
            <Button onClick={exportLedgerToCsv} variant="secondary" className="text-xs font-bold">
              📥 Exportar a Excel / CSV
            </Button>
          </div>

          <Card title="Plan General de Cuentas Contables">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 bg-slate-50">
                    <th className="py-2 px-3">Código</th>
                    <th className="py-2 px-3">Nombre de Cuenta</th>
                    <th className="py-2 px-3">Tipo Contable</th>
                    <th className="py-2 px-3">Moneda</th>
                    <th className="py-2 px-3 text-right">Saldo Calculado</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerAccounts.map((a) => (
                    <tr
                      key={a.id}
                      className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
                        selectedLedgerAccount === a.id ? "bg-blue-50/70 font-bold" : ""
                      }`}
                      onClick={() => setSelectedLedgerAccount(selectedLedgerAccount === a.id ? "" : a.id)}
                    >
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">{a.code}</td>
                      <td className="py-2 px-3">{a.name}</td>
                      <td className="py-2 px-3">
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
                      <td className="py-2 px-3 font-mono">{a.currency}</td>
                      <td className="py-2 px-3 text-right font-black text-slate-900">{fmtMoney(a.balance, a.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={selectedLedgerAccount ? "Asientos de la Cuenta Seleccionada" : "Libro Diario (Últimos Asientos)"}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 bg-slate-50">
                    <th className="py-2 px-3">Fecha</th>
                    <th className="py-2 px-3">Asiento / Ref</th>
                    <th className="py-2 px-3">Cuenta</th>
                    <th className="py-2 px-3">Lado</th>
                    <th className="py-2 px-3 text-right">Monto</th>
                    <th className="py-2 px-3">Concepto / Glosa</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries
                    .filter((e) => !selectedLedgerAccount || e.accountId === selectedLedgerAccount)
                    .map((e) => (
                      <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-500">{fmtDate(e.createdAt)}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-700">{e.entryGroup ?? "—"}</td>
                        <td className="py-2 px-3 font-mono">
                          {e.account.code} · {e.account.name}
                        </td>
                        <td className="py-2 px-3">
                          <Badge className={e.side === "DEBIT" ? "bg-red-100 text-red-800 font-bold" : "bg-emerald-100 text-emerald-800 font-bold"}>
                            {e.side === "DEBIT" ? "DÉBITO (Debe)" : "CRÉDITO (Haber)"}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right font-black text-slate-900">
                          {fmtMoney(e.amount, e.currency || e.account.currency)}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{e.description ?? "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ==================== MODALES ==================== */}

      {/* MODAL CONFIGURAR SALDOS REALES INICIALES */}
      <Modal open={showResetModal} onClose={() => setShowResetModal(false)} title="⚙️ Configurar Saldos Reales Iniciales de Apertura">
        <form onSubmit={handleResetInitialData} className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
            <div className="font-bold">⚠️ Atención: Apertura Limpia de Contabilidad</div>
            <div>
              Esta acción eliminará todas las operaciones de prueba y configurará los saldos reales de apertura en tus cuentas bancarias oficiales y cajas físicas, creando el asiento de Capital Social.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-emerald-800 uppercase">🇪🇨 Ecuador (Dólares USD)</span>
              <Input
                label="Saldo Real Banco Pichincha (USD)"
                type="number"
                step="0.01"
                min="0"
                value={resetForm.pichinchaBalanceUsd}
                onChange={(e) => setResetForm((f) => ({ ...f, pichinchaBalanceUsd: e.target.value }))}
                required
              />
              <Input
                label="Saldo Real Caja Efectivo Ecuador (USD)"
                type="number"
                step="0.01"
                min="0"
                value={resetForm.cashEcBalanceUsd}
                onChange={(e) => setResetForm((f) => ({ ...f, cashEcBalanceUsd: e.target.value }))}
                required
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-red-800 uppercase">🇵🇪 Perú (Soles PEN)</span>
              <Input
                label="Saldo Real Banco BCP (PEN)"
                type="number"
                step="0.01"
                min="0"
                value={resetForm.bcpBalancePen}
                onChange={(e) => setResetForm((f) => ({ ...f, bcpBalancePen: e.target.value }))}
                required
              />
              <Input
                label="Saldo Real Caja Efectivo Perú (PEN)"
                type="number"
                step="0.01"
                min="0"
                value={resetForm.cashPeBalancePen}
                onChange={(e) => setResetForm((f) => ({ ...f, cashPeBalancePen: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Nombre del Socio / Aportante de Apertura"
              value={resetForm.partnerName}
              onChange={(e) => setResetForm((f) => ({ ...f, partnerName: e.target.value }))}
              required
            />
            <Input
              label="Notas / Glosa de Apertura"
              value={resetForm.notes}
              onChange={(e) => setResetForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowResetModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={working} className="flex-1 font-bold bg-amber-600 hover:bg-amber-700 text-white">
              🚀 Guardar Saldos Reales y Abrir Contabilidad
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL REGISTRAR GASTO */}
      <Modal open={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="🧾 Registrar Gasto o Factura de Proveedor">
        <form onSubmit={handleSubmitExpense} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Seleccionar Proveedor Registrado (Opcional)"
              value={expenseForm.supplierId}
              onChange={(e) => handleSelectSupplierInExpense(e.target.value)}
            >
              <option value="">-- Escribir Proveedor Manualmente --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.taxId || "Sin RUC"})
                </option>
              ))}
            </Select>

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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Nombre del Proveedor o Persona"
              placeholder="Ej: CNT / Claro / Arrendador"
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              label="N° Factura / Recibo"
              placeholder="Ej: 001-002-00012345"
              value={expenseForm.invoiceNumber}
              onChange={(e) => setExpenseForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
            />
            <Select
              label="Moneda y País"
              value={expenseForm.currency}
              onChange={(e) => {
                const cur = e.target.value;
                const defaultRate = cur === "USD" ? "15" : "18";
                setExpenseForm((f) => ({ ...f, currency: cur, taxRate: defaultRate }));
                handleExpenseAmountChange("taxRate", defaultRate);
              }}
            >
              <option value="USD">🇪🇨 Ecuador (USD $)</option>
              <option value="PEN">🇵🇪 Perú (PEN S/)</option>
            </Select>
            <Input
              label="Fecha de Pago"
              type="date"
              value={expenseForm.paidAt}
              onChange={(e) => setExpenseForm((f) => ({ ...f, paidAt: e.target.value }))}
              required
            />
          </div>

          {/* Desglose de Montos e Impuestos */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
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
              <span>Impuesto calculado: <strong>{fmtMoney(parseFloat(expenseForm.taxAmount) || 0, expenseForm.currency)}</strong></span>
              <span>Total a descontar: <strong className="text-red-700">{fmtMoney(parseFloat(expenseForm.total) || 0, expenseForm.currency)}</strong></span>
            </div>
          </div>

          {/* Origen de Fondos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Forma de Pago (Origen de Fondos)"
              value={expenseForm.paymentSourceType}
              onChange={(e) => setExpenseForm((f) => ({ ...f, paymentSourceType: e.target.value as "BANK" | "CASH" }))}
            >
              <option value="BANK">🏦 Cuenta Bancaria Oficial</option>
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
                label="Seleccionar Caja de Pago"
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

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              📎 Foto o PDF del Comprobante / Factura (Opcional)
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => handleFileUpload(e, (url) => setExpenseForm((f) => ({ ...f, receiptUrl: url })))}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowExpenseModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={working} className="flex-1 font-bold">
              💾 Guardar y Contabilizar
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL CREAR / EDITAR PROVEEDOR */}
      <Modal open={showSupplierModal} onClose={() => setShowSupplierModal(false)} title={supplierForm.id ? "✏️ Editar Proveedor" : "🏢 Registrar Nuevo Proveedor"}>
        <form onSubmit={handleSubmitSupplier} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Razón Social o Nombre del Proveedor"
              placeholder="Ej: Corporación Nacional de Telecomunicaciones"
              value={supplierForm.name}
              onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <Input
              label="RUC / DNI / CI"
              placeholder="Ej: 1790000000001"
              value={supplierForm.taxId}
              onChange={(e) => setSupplierForm((f) => ({ ...f, taxId: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="País de Operación"
              value={supplierForm.countryCode}
              onChange={(e) => setSupplierForm((f) => ({ ...f, countryCode: e.target.value }))}
            >
              <option value="EC">🇪🇨 Ecuador</option>
              <option value="PE">🇵🇪 Perú</option>
            </Select>
            <Select
              label="Categoría Habitual de Gasto"
              value={supplierForm.category}
              onChange={(e) => setSupplierForm((f) => ({ ...f, category: e.target.value }))}
            >
              {Object.entries(CATEGORY_NAMES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Teléfono / Celular"
              placeholder="Ej: +593 999 123 456"
              value={supplierForm.phone}
              onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label="Correo Electrónico"
              placeholder="facturacion@proveedor.com"
              value={supplierForm.email}
              onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Banco de Pago del Proveedor"
              placeholder="Ej: Banco Pichincha / BCP"
              value={supplierForm.bankName}
              onChange={(e) => setSupplierForm((f) => ({ ...f, bankName: e.target.value }))}
            />
            <Input
              label="Número de Cuenta Bancaria"
              placeholder="Ej: 2100123456"
              value={supplierForm.bankAccountNumber}
              onChange={(e) => setSupplierForm((f) => ({ ...f, bankAccountNumber: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowSupplierModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={working} className="flex-1 font-bold">
              💾 Guardar Proveedor
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL CREAR / EDITAR EMPLEADO */}
      <Modal open={showEmployeeModal} onClose={() => setShowEmployeeModal(false)} title={employeeForm.id ? "✏️ Editar Trabajador" : "👥 Registrar Nuevo Trabajador"}>
        <form onSubmit={handleSubmitEmployee} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Nombre Completo"
              placeholder="Ej: Ana María López"
              value={employeeForm.fullName}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, fullName: e.target.value }))}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <Select
                label="Tipo Doc"
                value={employeeForm.documentType}
                onChange={(e) => setEmployeeForm((f) => ({ ...f, documentType: e.target.value as any }))}
              >
                <option value="CEDULA">Cédula</option>
                <option value="DNI">DNI</option>
                <option value="PASSPORT">Pasaporte</option>
                <option value="RUC">RUC</option>
              </Select>
              <Input
                label="N° Documento"
                placeholder="1720000000"
                value={employeeForm.documentNumber}
                onChange={(e) => setEmployeeForm((f) => ({ ...f, documentNumber: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select
              label="País"
              value={employeeForm.countryCode}
              onChange={(e) => {
                const c = e.target.value;
                setEmployeeForm((f) => ({
                  ...f,
                  countryCode: c,
                  salaryCurrency: c === "EC" ? "USD" : "PEN",
                  bankName: c === "EC" ? "Banco Pichincha" : "BCP",
                }));
              }}
            >
              <option value="EC">🇪🇨 Ecuador</option>
              <option value="PE">🇵🇪 Perú</option>
            </Select>
            <Input
              label="Cargo / Puesto"
              placeholder="Ej: Cajero Principal / Supervisor"
              value={employeeForm.position}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, position: e.target.value }))}
              required
            />
            <Input
              label={`Sueldo Base (${employeeForm.salaryCurrency})`}
              type="number"
              step="0.01"
              min="0"
              value={employeeForm.baseSalary}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, baseSalary: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Banco para Pago de Sueldo"
              placeholder="Ej: Banco Pichincha / BCP"
              value={employeeForm.bankName}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, bankName: e.target.value }))}
            />
            <Input
              label="Número de Cuenta Bancaria del Empleado"
              placeholder="Ej: 2100987654"
              value={employeeForm.bankAccountNumber}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, bankAccountNumber: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowEmployeeModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={working} className="flex-1 font-bold">
              💾 Guardar Trabajador
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL PAGAR NÓMINA */}
      <Modal open={showPayrollModal} onClose={() => setShowPayrollModal(false)} title="💸 Liquidación y Pago de Sueldo / Nómina">
        <form onSubmit={handleSubmitPayroll} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Seleccionar Trabajador"
              value={payrollForm.employeeId}
              onChange={(e) => {
                const id = e.target.value;
                const emp = employees.find((x) => x.id === id);
                if (emp) {
                  setPayrollForm((f) => ({
                    ...f,
                    employeeId: id,
                    amount: String(emp.baseSalary),
                    currency: emp.salaryCurrency,
                  }));
                }
              }}
              required
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} — {emp.position} ({fmtMoney(emp.baseSalary, emp.salaryCurrency)})
                </option>
              ))}
            </Select>

            <Input
              label="Periodo / Mes a Pagar"
              placeholder="Ej: Agosto 2026 / 1ra Quincena Agosto 2026"
              value={payrollForm.period}
              onChange={(e) => setPayrollForm((f) => ({ ...f, period: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label={`Monto a Pagar (${payrollForm.currency})`}
              type="number"
              step="0.01"
              min="0.01"
              value={payrollForm.amount}
              onChange={(e) => setPayrollForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
            <Select
              label="Forma de Pago"
              value={payrollForm.paymentSourceType}
              onChange={(e) => setPayrollForm((f) => ({ ...f, paymentSourceType: e.target.value as "BANK" | "CASH" }))}
            >
              <option value="BANK">🏦 Cuenta Bancaria Oficial</option>
              <option value="CASH">💵 Caja de Efectivo</option>
            </Select>
          </div>

          {payrollForm.paymentSourceType === "BANK" ? (
            <Select
              label="Banco de Salida"
              value={payrollForm.bankAccountId}
              onChange={(e) => setPayrollForm((f) => ({ ...f, bankAccountId: e.target.value }))}
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
              label="Caja de Salida"
              value={payrollForm.cashAccountId}
              onChange={(e) => setPayrollForm((f) => ({ ...f, cashAccountId: e.target.value }))}
              required
            >
              {summary?.liquidity.cash.accounts.map((c) => (
                <option key={c.id} value={c.id}>
                  Caja {c.code} ({c.country} {c.currency}) — Saldo: {fmtMoney(c.balance, c.currency)}
                </option>
              ))}
            </Select>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              📎 Comprobante de Transferencia / Recibo de Firma (Opcional)
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => handleFileUpload(e, (url) => setPayrollForm((f) => ({ ...f, receiptUrl: url })))}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowPayrollModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={working} className="flex-1 font-bold bg-purple-600 hover:bg-purple-700 text-white">
              💸 Confirmar y Liquidar Pago
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL MOVIMIENTO BANCARIO DIRECTO */}
      <Modal open={showBankMovementModal} onClose={() => setShowBankMovementModal(false)} title="🏦 Registrar Depósito o Retiro Bancario">
        <form onSubmit={handleSubmitBankMovement} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Cuenta Bancaria Oficial"
              value={bankMovementForm.bankAccountId}
              onChange={(e) => {
                const id = e.target.value;
                const b = summary?.liquidity.banks.accounts.find((x) => x.id === id);
                setBankMovementForm((f) => ({
                  ...f,
                  bankAccountId: id,
                  currency: b?.currency || "USD",
                }));
              }}
              required
            >
              {summary?.liquidity.banks.accounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.currency}) — Saldo: {fmtMoney(b.balance, b.currency)}
                </option>
              ))}
            </Select>

            <Select
              label="Tipo de Movimiento"
              value={bankMovementForm.type}
              onChange={(e) => setBankMovementForm((f) => ({ ...f, type: e.target.value as "DEPOSIT" | "WITHDRAWAL" }))}
            >
              <option value="DEPOSIT">🟢 Depósito Bancario (Entrada de Dinero)</option>
              <option value="WITHDRAWAL">🔴 Retiro / Débito Bancario (Salida de Dinero)</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label={`Monto (${bankMovementForm.currency})`}
              type="number"
              step="0.01"
              min="0.01"
              value={bankMovementForm.amount}
              onChange={(e) => setBankMovementForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
            <Input
              label="N° Operación / Referencia Bancaria"
              placeholder="Ej: DEP-89102"
              value={bankMovementForm.reference}
              onChange={(e) => setBankMovementForm((f) => ({ ...f, reference: e.target.value }))}
            />
          </div>

          <Input
            label="Descripción / Motivo"
            placeholder="Ej: Depósito de fondeo / Retiro en ventanilla"
            value={bankMovementForm.description}
            onChange={(e) => setBankMovementForm((f) => ({ ...f, description: e.target.value }))}
          />

          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowBankMovementModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={working} className="flex-1 font-bold">
              💾 Guardar Movimiento
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL IMPORTAR EXTRACTO BANCARIO */}
      <Modal open={showBankStatementModal} onClose={() => setShowBankStatementModal(false)} title="📑 Importar Extracto Bancario (Pichincha / BCP)">
        <form onSubmit={handleSubmitBankStatement} className="space-y-4">
          <Select
            label="Seleccionar Cuenta Bancaria del Extracto"
            value={statementForm.bankAccountId}
            onChange={(e) => setStatementForm((f) => ({ ...f, bankAccountId: e.target.value }))}
            required
          >
            {summary?.liquidity.banks.accounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.currency}) — Saldo: {fmtMoney(b.balance, b.currency)}
              </option>
            ))}
          </Select>

          <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-1">
            <div className="font-bold">Formato del Extracto CSV:</div>
            <div>
              El archivo CSV debe contener las columnas: <code>Fecha, Descripción, Monto, Referencia</code>. (Montos positivos para depósitos y negativos para retiros).
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Seleccionar Archivo CSV / TXT descargado del Banco
            </label>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleStatementFileChange}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              required
            />
          </div>

          {statementForm.parsedLines.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="font-bold text-slate-800">
                ✓ Se detectaron {statementForm.parsedLines.length} transacciones listas para importar.
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowBankStatementModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={working} className="flex-1 font-bold">
              🚀 Importar y Conciliar
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL TRASPASO ENTRE CUENTAS */}
      <Modal open={showTransferModal} onClose={() => setShowTransferModal(false)} title="🔄 Traspaso de Fondos (Banco ↔ Caja)">
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

      {/* MODAL CAPITAL Y SOCIOS */}
      <Modal open={showCapitalModal} onClose={() => setShowCapitalModal(false)} title="💵 Registrar Aporte o Retiro de Socio">
        <form onSubmit={handleSubmitCapital} className="space-y-4">
          <Select
            label="Tipo de Operación"
            value={capitalForm.type}
            onChange={(e) => setCapitalForm((f) => ({ ...f, type: e.target.value as "INJECTION" | "WITHDRAWAL" }))}
          >
            <option value="INJECTION">➕ Inyección / Aporte de Capital</option>
            <option value="WITHDRAWAL">💸 Retiro de Utilidades / Dividendos</option>
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
              value={capitalForm.partnerName}
              onChange={(e) => setCapitalForm((f) => ({ ...f, partnerName: e.target.value }))}
            />
            <Input
              label="Concepto"
              value={capitalForm.concept}
              onChange={(e) => setCapitalForm((f) => ({ ...f, concept: e.target.value }))}
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

      {/* MODAL PREVIEW VISOR FOTO / PDF */}
      <Modal open={!!previewReceiptUrl} onClose={() => setPreviewReceiptUrl(null)} title="📎 Comprobante Adjunto">
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

# 📋 MEMORY — Proyecto Divisas
_Última actualización: 2026-08-24_

## 🔗 Repositorio GitHub
- **URL:** https://github.com/Danny3969/Divisas
- **Rama principal:** `main`

## 🏗️ Estructura del Proyecto
```
/Users/contabilidad/.gemini/antigravity-ide/scratch/Divisas/
├── backend/          → NestJS + Prisma + PostgreSQL (puerto 3000)
├── apps/
│   ├── admin/        → Next.js Consola Administración (puerto 3001)
│   └── cashier/      → Next.js Consola de Caja (puerto 3002)
├── ecosystem.config.js → Configuración PM2
└── MEMORY.md
```

## 🗄️ Base de Datos
- **PostgreSQL 16** (Docker Compose) en `localhost:5433`
- **Usuario:** `divisas` | **Password:** `divisas_dev` | **DB:** `divisas`
- **ORM:** Prisma

## 👤 Usuarios del Sistema
| Email | Contraseña | Rol | País |
|---|---|---|---|
| `admin@divisas.com` | `Divisas2026!` | ADMIN | — |
| `cajero.pe@divisas.com` | `Divisas2026!` | CASHIER | 🇵🇪 Perú |
| `cajero.ec@divisas.com` | `Divisas2026!` | CASHIER | 🇪🇨 Ecuador |
| `supervisor@divisas.com` | `Divisas2026!` | SUPERVISOR | — |
| `compliance@divisas.com` | `Divisas2026!` | COMPLIANCE | — |

## ⚙️ PM2 — Gestión de Procesos
```bash
npx pm2 start ecosystem.config.js   # Iniciar todo
npx pm2 restart all                  # Reiniciar todo
npx pm2 status                       # Ver estado
npx pm2 logs                         # Ver logs en tiempo real
```
**Procesos PM2:** `divisas-backend`, `divisas-admin`, `divisas-cashier`, 
`divisas-tunnel-backend`, `divisas-tunnel-admin`, `divisas-tunnel-cashier`

## 🌐 URLs Locales (siempre disponibles)
- **Backend API:** http://localhost:3000/api
- **Admin:** http://localhost:3001
- **Caja:** http://localhost:3002

## 🌍 URLs Públicas Activas (Cloudflare Tunnels)
- **Consola de Administración (Admin):** https://edinburgh-aspects-pixels-twice.trycloudflare.com
- **Consola de Caja (Cashier):** https://revised-corporation-educators-beyond.trycloudflare.com
- **Backend API:** https://even-valves-patents-dealers.trycloudflare.com/api

> Para consultar URLs si se reinician los túneles:
> `grep "trycloudflare.com" ~/.pm2/logs/divisas-tunnel-admin-error.log | tail -n 1`

## 🚀 Funcionalidades Implementadas

### Módulo de Contabilidad y Tesorería Financiera (`/ledger`)
- [x] **Panel Financiero & P&L en Tiempo Real:**
  - Liquidez global consolidada en USD (Ecuador) y PEN (Perú).
  - Saldos en vivo de cuentas bancarias (Banco Pichincha, Banco Guayaquil, BCP) y cajas físicas.
  - Estado de Pérdidas y Ganancias (P&L): Ingresos por comisiones de giros + Margen FX Spread - Gastos Operativos = Utilidad Neta Real.
- [x] **Registro de Gastos y Facturas con Desglose de Impuestos:**
  - Categorías operativas (Alquiler, Servicios Básicos, Nómina, Comisiones Bancarias, Software, Suministros, etc.).
  - Desglose y cálculo automático: Subtotal + IVA 15% (Ecuador) o IGV 18% (Perú) o Exento = Total.
  - Soporte de comprobante adjunto (Fotos de recibos o archivos PDF con visor integrado).
  - Descuento automático de saldo de la cuenta bancaria o caja seleccionada.
- [x] **Traspasos y Fondeos Internos:**
  - Registro de movimientos entre bancos y cajas (ej. depósito de efectivo a banco).
- [x] **Movimientos de Capital:**
  - Aportes/inyecciones de capital y retiros de utilidades por parte de socios.
- [x] **Motor Contable Double-Entry Ledger:**
  - Asientos automáticos de partida doble matemática e inmutable en cada gasto, traspaso o movimiento.
  - Libro diario completo con botón para **Exportar a Excel / CSV**.

### Consola de Caja (`apps/cashier`)
- [x] Proxy de API integrado en `next.config.ts`.
- [x] Nueva Transferencia con 3 métodos: **Efectivo**, **Yape**, **Cuenta Bancaria**.
- [x] Identificación visual por país (🇵🇪 Rojo / 🇪🇨 Amarillo).
- [x] Prefijos de teléfono automáticos (+51 / +593).

### Consola de Administración (`apps/admin`)
- [x] Clientes: CRUD completo.
- [x] Sección **Beneficiarios**: lista, búsqueda, editar, eliminar.
- [x] Sección **Contabilidad** con panel interactivo de 5 pestañas.

## 📝 Notas Técnicas
- **Normalización de teléfonos:** `normalizePhone()` en `lib/format.ts` (cashier y admin)
- **Presentación de teléfonos:** `fmtPhone()` en `lib/format.ts`
- **Proxy transparente:** Peticiones `/api/*` reenviadas internamente al backend.

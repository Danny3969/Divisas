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
- **Consola de Administración (Admin):** https://volume-dialogue-down-stop.trycloudflare.com
- **Consola de Caja (Cashier):** https://campaign-gloves-entitled-parks.trycloudflare.com
- **Backend API:** https://solved-loud-rating-belly.trycloudflare.com/api

> Para consultar URLs si se reinician los túneles:
> `grep "trycloudflare.com" ~/.pm2/logs/divisas-tunnel-admin-error.log | tail -n 1`

## 🚀 Funcionalidades Implementadas

### Módulo de Contabilidad Empresarial y Tesorería (`/ledger`)
- [x] **Configuración de Saldos Reales Iniciales / Purga Limpia:**
  - Apertura limpia de contabilidad estableciendo los saldos reales en Banco Pichincha (USD), BCP (PEN) y Cajas de efectivo con asiento automático a Capital Social.
- [x] **Gestión Bancaria y Conciliación Inteligente:**
  - Flujo de depósitos y retiros directos en Banco Pichincha (Ecuador) y BCP (Perú).
  - Importador y conciliador de extractos bancarios en CSV/Excel con detección de movimientos, cotejo automático y creación de gastos/ingresos en 1 clic.
- [x] **Directorio de Proveedores:**
  - Catálogo de proveedores con RUC/DNI, razón social, categoría habitual y cuentas bancarias.
  - Autocompletado directo al registrar facturas y gastos.
- [x] **Personal y Nómina de Sueldos:**
  - Registro de trabajadores con cargos, salarios base pactados (USD o PEN), país y cuenta bancaria de depósito.
  - Modal de liquidación y pago de nómina con 1 clic (descuenta de la cuenta/caja y registra asiento en cuenta `5030 Sueldos y Nómina`).
- [x] **Facturas y Gastos con Desglose de Impuestos:**
  - Desglose y cálculo automático: Subtotal + IVA 15% (Ecuador) o IGV 18% (Perú) o Exento = Total.
  - Soporte de comprobante adjunto (Fotos de recibos o archivos PDF con visor integrado).
- [x] **Traspasos Internos y Capital:**
  - Fondeo de caja desde el banco y depósitos de recaudación a banco.
  - Aportes y retiros de utilidades de socios.
- [x] **Libro Contable Double-Entry y Exportación:**
  - Asientos de partida doble matemática inmutables.
  - Exportación del Libro Diario a Excel / CSV en 1 clic.

### Consola de Caja (`apps/cashier`)
- [x] Proxy de API integrado en `next.config.ts`.
- [x] Nueva Transferencia con 3 métodos: **Efectivo**, **Yape**, **Cuenta Bancaria**.
- [x] Identificación visual por país (🇵🇪 Rojo / 🇪🇨 Amarillo).
- [x] Prefijos de teléfono automáticos (+51 / +593).

### Consola de Administración (`apps/admin`)
- [x] Clientes: CRUD completo.
- [x] Sección **Beneficiarios**: lista, búsqueda, editar, eliminar.
- [x] Sección **Contabilidad** con panel interactivo de 7 pestañas.

## 📝 Notas Técnicas
- **Normalización de teléfonos:** `normalizePhone()` en `lib/format.ts` (cashier y admin)
- **Presentación de teléfonos:** `fmtPhone()` en `lib/format.ts`
- **Proxy transparente:** Peticiones `/api/*` reenviadas internamente al backend.

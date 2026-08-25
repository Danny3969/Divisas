# 📋 MEMORY — Proyecto VALEX (Cambio de Divisas & Giros Internacionales)
_Última actualización: 2026-08-25_

## 🔗 Repositorio GitHub
- **URL:** https://github.com/Danny3969/Divisas
- **Rama principal:** `main`

## 🏗️ Arquitectura del Sistema
```
/Users/contabilidad/.gemini/antigravity-ide/scratch/Divisas/
├── backend/          → NestJS + Prisma + PostgreSQL (puerto 3000)
├── apps/
│   ├── admin/        → Portal Web Unificado (Admin + Caja) (puerto 3001)
│   ├── cashier/      → Consola de Caja (legada / complementaria) (puerto 3002)
│   └── mobile/       → App Móvil React Native / Expo (com.valex.app)
├── ecosystem.config.js → Configuración PM2
└── MEMORY.md
```

## 🗄️ Base de Datos
- **PostgreSQL 16** (Docker Compose) en `localhost:5433`
- **Usuario:** `divisas` | **Password:** `divisas_dev` | **DB:** `divisas`
- **ORM:** Prisma

## 👤 Usuarios del Sistema
| Email | Contraseña | Rol | Acceso / Asignación |
|---|---|---|---|
| `admin@valex.com` / `admin@divisas.com` | `Valex2026!` | ADMIN | Portal Completo (Admin + Ventanilla) |
| `cajero.pe@valex.com` / `cajero.pe@divisas.com` | `Valex2026!` | CASHIER | 🇵🇪 Ventanilla Perú (Sullana) |
| `cajero.ec@valex.com` / `cajero.ec@divisas.com` | `Valex2026!` | CASHIER | 🇪🇨 Ventanilla Ecuador (Macará) |
| `supervisor@valex.com` / `supervisor@divisas.com` | `Valex2026!` | SUPERVISOR | Supervisión de Cajas y Operaciones |
| `compliance@valex.com` / `compliance@divisas.com` | `Valex2026!` | COMPLIANCE | Cumplimiento y Aprobación KYC |
| `treasury@valex.com` / `treasury@divisas.com` | `Valex2026!` | TREASURY | Tesorería y Bancos |
| `cliente.ec@valex.com` | `Valex2026!` | CUSTOMER | 📱 App Móvil (Ecuador - USD) |
| `cliente.pe@valex.com` | `Valex2026!` | CUSTOMER | 📱 App Móvil (Perú - PEN) |

## ⚙️ PM2 — Gestión de Procesos
```bash
npx pm2 start ecosystem.config.js   # Iniciar todo
npx pm2 restart all                  # Reiniciar todo
npx pm2 status                       # Ver estado
npx pm2 logs                         # Ver logs en tiempo real
```

## 🌐 URLs Locales (siempre disponibles)
- **Backend API:** http://localhost:3000/api
- **Portal Web Unificado (Admin + Caja):** http://localhost:3001
- **Caja (puerto independiente):** http://localhost:3002

## 🌍 URLs Públicas Activas (Cloudflare Tunnels)
- **Portal Web Unificado (Admin & Caja):** https://bet-kansas-organizations-followed.trycloudflare.com
- **Backend API:** https://volume-cartridge-previews-cigarettes.trycloudflare.com/api
- **Descarga Directa APK Móvil (Android):** https://bet-kansas-organizations-followed.trycloudflare.com/downloads/VALEX.apk

## 📱 Aplicación Móvil Android (APK)
- **Ruta Local del APK:** `/Users/contabilidad/.gemini/antigravity-ide/scratch/Divisas/aplicaciones/mobile/VALEX-v1.0.0.apk`
- **Descarga Web:** `http://localhost:3001/downloads/VALEX.apk`
- **Tamaño:** 103 MB
- **Package Android:** `com.valex.app`
- **Configuración:** Conectado a la API pública / local con la identidad y el icono oficial de VALEX.

> Para consultar URLs si se reinician los túneles:
> `grep "trycloudflare.com" ~/.pm2/logs/divisas-tunnel-admin-error.log | tail -n 1`


## 🚀 Funcionalidades Implementadas

### Módulo de Comisiones por Tramos en Soles (`/fees`)
- [x] **Tabla Dinámica y Escalonada por Tramos en Soles (PEN):**
  - **1 a 500 soles:** $1.00 USD
  - **501 a 1,000 soles:** $2.00 USD
  - **1,001 a 2,000 soles:** $3.00 USD
  - **2,001 a 5,000 soles:** $4.00 USD
  - **5,001 a 10,000 soles:** $5.00 USD
  - **Más de 10,000 soles:** $6.00 USD (configurable)
- [x] **Panel Web CRUD Completo:** Creación, edición, activación/desactivación y eliminación de tramos en vivo.
- [x] **Simulador Interactivo:** Cálculo en tiempo real de equivalencia en soles, tramo aplicado, comisión y neto a entregar.
- [x] **Cobro Simétrico en Ambas Puntas:** Ambas cajas (Ecuador y Perú) operan bajo la misma regla de comisiones en ventanilla y cotizaciones.

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
- [x] Identificación visual por país (🇵🇪 Rojo / 🇪🇨 Amarillo) con cabecera y logo VALEX.
- [x] Prefijos de teléfono automáticos (+51 / +593).

### Consola de Administración (`apps/admin`)
- [x] Clientes: CRUD completo.
- [x] Sección **Beneficiarios**: lista, búsqueda, editar, eliminar.
- [x] Sección **Usuarios y Accesos**:
  - Crear nuevo usuario con nombre, correo, teléfono, rol y asignación de agencia.
  - Editar datos de usuario, roles, asignación de oficina y estado activo/inactivo.
  - Eliminar usuarios con confirmación y protección de cuenta superadmin.
  - Restablecer contraseña individual.
- [x] Sección **Contabilidad** con panel interactivo de 7 pestañas.
- [x] Botón de descarga de APK **VALEX.apk** integrado en la barra lateral.

## 🏛️ Identidad de Marca Oficial — VALEX
- **Nombre Oficial:** **VALEX** *(Valor + Exchange)*
- **Eslogan:** *Tu dinero con más valor.*
- **Isotipo Oficial:** *Dynamic Exchange X* (Flechas dinámicas de intercambio transfronterizo).
- **Tipografía Oficial:** Fuente geométrica sans-serif moderna con cortes tecnológicos en **A** y **E**.
- **Paleta Cromática Oficial:**
  - **Cyan Eléctrico:** `#00E5FF`
  - **Blanco Puro:** `#FFFFFF`
  - **Slate Plomo:** `#475569`
- **Manual de Marca & Assets:** [`docs/branding/MANUAL_DE_MARCA_VALEX.md`](docs/branding/MANUAL_DE_MARCA_VALEX.md)
  - Carpeta de activos visuales, iconos y mockups en alta resolución: `docs/branding/assets/`
- **Implementación Completada:**
  - [x] Consola de Administración (`apps/admin`) con branding, favicon, logo e isotipo en fondo plomo.
  - [x] Consola de Caja (`apps/cashier`) con branding, favicon, logo e isotipo en fondo plomo.
  - [x] App Móvil Android (`apps/mobile`, `com.valex.app`) con nuevo ícono, splash screen y binario `VALEX-v1.0.0.apk`.
  - [x] Plantillas de tickets y notificaciones WhatsApp actualizadas a VALEX.

## 📝 Notas Técnicas
- **Normalización de teléfonos:** `normalizePhone()` en `lib/format.ts` (cashier y admin)
- **Presentación de teléfonos:** `fmtPhone()` en `lib/format.ts`
- **Proxy transparente:** Peticiones `/api/*` reenviadas internamente al backend.


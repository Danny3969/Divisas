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
- **Consola de Administración (Admin):** https://providence-typing-only-pix.trycloudflare.com
- **Consola de Caja (Cashier):** https://market-cms-cohen-pointed.trycloudflare.com
- **Backend API:** https://marshall-critical-dover-tribes.trycloudflare.com/api

> Para consultar URLs si se reinician los túneles:
> `grep -E -o "https://[a-zA-Z0-9-]+\.trycloudflare\.com" ~/.pm2/logs/divisas-tunnel-*.log | sort -u`

## 🚀 Funcionalidades y Correcciones Implementadas

### Backend (backend/src)
- [x] Contenedor Docker PostgreSQL iniciado y sincronizado (`prisma db push`).
- [x] Corrección en `prisma/seed.ts` para actualización consistente de contraseñas y unicidad de cuentas bancarias.
- [x] Auth: `login` devuelve `office.country` para identificar caja.
- [x] Customers: KYC auto-aprobado al crear.
- [x] Beneficiaries: CRUD completo con búsqueda por nombre/documento/teléfono.
- [x] Soporte de teléfonos con prefijo internacional.

### Consola de Caja (apps/cashier)
- [x] Proxy de API integrado en `next.config.ts` (evita problemas de CORS y URLs caducadas).
- [x] Nueva Transferencia con 3 métodos: **Efectivo**, **Yape**, **Cuenta Bancaria**.
- [x] Identificación visual por país (🇵🇪 Rojo / 🇪🇨 Amarillo).
- [x] Prefijos de teléfono automáticos (+51 / +593).

### Consola de Administración (apps/admin)
- [x] Proxy de API integrado en `next.config.ts`.
- [x] Clientes: botones Editar y Eliminar.
- [x] Sección **Beneficiarios**: lista, búsqueda, editar, eliminar.

### Infraestructura
- [x] Instalación de `cloudflared` en el sistema y configuración en PM2.
- [x] Configuración dinámica en `next.config.ts` para enrutamiento transparente local y público.

## 📝 Notas Técnicas
- **Normalización de teléfonos:** `normalizePhone()` en `lib/format.ts` (cashier y admin)
- **Presentación de teléfonos:** `fmtPhone()` en `lib/format.ts`
- **Proxy transparente:** Tanto la consola de admin como la de caja reenvián peticiones `/api/*` al backend automáticamente sin depender de URLs de Cloudflare quemadas en el código cliente.

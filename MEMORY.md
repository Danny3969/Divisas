# 📋 MEMORY — Proyecto Divisas
_Última actualización: 2026-08-24_

## 🔗 Repositorio GitHub
- **URL:** https://github.com/Danny3969/Divisas
- **Rama principal:** `main`

## 🏗️ Estructura del Proyecto
```
/Users/digitalspace/Desktop/Divisas/
├── backend/          → NestJS + Prisma + PostgreSQL (puerto 3000)
├── apps/
│   ├── admin/        → Next.js Consola Administración (puerto 3001)
│   └── cashier/      → Next.js Consola de Caja (puerto 3002)
├── ecosystem.config.js → Configuración PM2
└── MEMORY.md
```

## 🗄️ Base de Datos
- **PostgreSQL** en `localhost:5433`
- **Usuario:** `divisas` | **Password:** `divisas_dev` | **DB:** `divisas`
- **ORM:** Prisma

## 👤 Usuarios del Sistema
| Email | Contraseña | Rol | País |
|---|---|---|---|
| `admin@divisas.com` | `Divisas2026!` | ADMIN | — |
| `cajero.pe@divisas.com` | `Divisas2026!` | CASHIER | 🇵🇪 Perú |
| `cajero.ec@divisas.com` | `Divisas2026!` | CASHIER | 🇪🇨 Ecuador |
| `supervisor@divisas.com` | `Divisas2026!` | SUPERVISOR | — |

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

## 🌍 URLs Públicas (Cloudflare — cambian al reiniciar tunnels)
> Ver logs con: `tail -20 ~/.pm2/logs/divisas-tunnel-XXX-error.log | grep "INF |"`

## 🚀 Funcionalidades Implementadas

### Consola de Caja (apps/cashier)
- [x] Nueva Transferencia con 3 métodos: **Efectivo**, **Yape**, **Cuenta Bancaria**
- [x] Formulario Yape: solo número de teléfono
- [x] Formulario Banco: datos completos de cuenta
- [x] Efectivo recibido = monto convertido a moneda local
- [x] **Identificación visual por país:**
  - 🇵🇪 `cajero.pe` → Header **rojo** → "Caja Perú"
  - 🇪🇨 `cajero.ec` → Header **amarillo** → "Caja Ecuador"
- [x] Prefijos de teléfono automáticos: +51 Perú / +593 Ecuador
- [x] Registro de clientes auto-aprobados (sin verificación manual)
- [x] Formulario de beneficiarios con selección de tipo de retiro

### Consola de Administración (apps/admin)
- [x] Clientes: botones ✏️ Editar y 🗑️ Eliminar
- [x] Registro de clientes sin verificación (auto-APPROVED)
- [x] Nueva sección **Beneficiarios**: lista, búsqueda, editar, eliminar
- [x] Sidebar con link a Beneficiarios
- [x] Teléfonos con prefijo de país en tablas (fmtPhone)

### Backend (backend/src)
- [x] Auth: `login` devuelve `office.country` para identificar caja
- [x] Customers: KYC auto-aprobado al crear
- [x] Beneficiaries: CRUD completo con búsqueda por nombre/documento/teléfono
- [x] Soporte de teléfonos con prefijo internacional

### Infraestructura
- [x] PM2 `ecosystem.config.js` configurado con auto-restart
- [x] Tunnels Cloudflare para acceso público desde internet

## 📝 Notas Técnicas
- **Normalización de teléfonos:** `normalizePhone()` en `lib/format.ts` (cashier y admin)
- **Presentación de teléfonos:** `fmtPhone()` en `lib/format.ts`
- **Los tunnels Cloudflare cambian URL al reiniciar** — son gratuitos/temporales
- **Para URLs permanentes:** configurar dominio propio en Cloudflare (pendiente)

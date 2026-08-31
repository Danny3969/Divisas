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
- **Supabase Cloud PostgreSQL**
- **Proyecto ID:** `cgrkckxqnesrewfweasr`
- **Host:** `aws-0-us-east-1.pooler.supabase.com:5432` (conexión directa) / `6543` (pooler)
- **Base de Datos:** `postgres`
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
- **VALEX Realizados:** https://bet-kansas-organizations-followed.trycloudflare.com/transfers
- **VALEX Recibidos (Caja de Retiro):** https://bet-kansas-organizations-followed.trycloudflare.com/payout
- **Nuevo VALEX:** https://bet-kansas-organizations-followed.trycloudflare.com/transfer/new
- **Panel General (Dashboard):** https://bet-kansas-organizations-followed.trycloudflare.com/dashboard
- **Backend API:** https://volume-cartridge-previews-cigarettes.trycloudflare.com/api
- **Consola de Caja Legada:** https://diversity-fails-businesses-oem.trycloudflare.com
- **Nombre de la App:** VALEX
- **Splash Screen:** Fondo Slate Marino `#0F172A` con Logotipo Oficial VALEX (Isotipo + Nombre)
- **Backend API Conectada:** `https://volume-cartridge-previews-cigarettes.trycloudflare.com/api`
- **Descarga Universal (Cualquier celular Android - 38 MB):** https://bet-kansas-organizations-followed.trycloudflare.com/downloads/VALEX.apk
- **Descarga Ultraligera (Celulares Modernos ARM64 - 19 MB):** https://bet-kansas-organizations-followed.trycloudflare.com/downloads/VALEX-arm64.apk
- **Dominio Comprado en Espera de DNS:** `valex-app.com`

## 📱 Aplicación Móvil Android (APK)
- **Ruta Local del APK:** `/Users/contabilidad/.gemini/antigravity-ide/scratch/Divisas/aplicaciones/mobile/VALEX-v1.0.0.apk`
- **Descarga Web:** `http://localhost:3001/downloads/VALEX.apk`
- **Tamaño:** 103 MB
- **Package Android:** `com.valex.app`
- **Configuración:** Conectado a la API pública / local con la identidad y el icono oficial de VALEX.

> Para consultar URLs si se reinician los túneles:
> `grep "trycloudflare.com" ~/.pm2/logs/divisas-tunnel-admin-error.log | tail -n 1`


## 🚀 Funcionalidades y Módulos Operativos

### 1. 📤 VALEX Realizados (`/transfers`)
- [x] **Separación de Flujos:** Visualización dedicada para giros emitidos desde las agencias.
- [x] **Pestañas por Caja y País:** Filtrado por `Todos`, `Ecuador 🇪🇨 → Perú 🇵🇪` (Caja Ecuador) y `Perú 🇵🇪 → Ecuador 🇪🇨` (Caja Perú).
- [x] **Seguridad de Código:** Enmascarado de código de retiro (`VLX-XXXX-••••`) en tabla para evitar cobros no autorizados por personal de emisión.
- [x] **Apertura de Transacción:** Soporte para apertura tanto por clic en fila, doble clic y botón de acción.

### 2. 📥 VALEX Recibidos & Caja de Retiro (`/payout`)
- [x] **Separación de Pestañas de Estado:**
  - `⏳ Pendientes de Entrega`: Operaciones activas listas para validar y pagar.
  - `✅ Cancelados / Entregados (Historial)`: Historial de transacciones ya liquidadas.
- [x] **Validación Estricta de Código Único de VALEX:** Campo interactivo que coteja el código dictado/presentado por el beneficiario.
- [x] **Soporte de Todas las Formas de Retiro:**
  - **💵 Efectivo en Ventanilla:** Descuenta saldo en físico de la caja de la agencia de entrega (`CREDIT 1020`) y cierra pasivo (`DEBIT 2030`).
  - **📱 Abono Yape (Billetera Móvil):** Liquida el pago, descuenta el saldo bancario/Yape de la empresa (`CREDIT 1010-PE`) y cierra pasivo (`DEBIT 2030`).
  - **🏦 Transferencia Bancaria:** Liquida el pago, descuenta el saldo bancario (`CREDIT 1010`) y cierra pasivo (`DEBIT 2030`).
- [x] **Invalidación Inmediata de Código:** Al pulsar "Confirmar Pago (Marcar Cancelado)", el código pasa a `withdrawalUsed: true` y el estado a `COMPLETED`.
- [x] **Bloqueo de Re-pago:** Cualquier intento de pagar un VALEX ya cancelado es bloqueado con error HTTP 400.

### 3. 💸 Nueva Emisión de VALEX (`/transfer/new`)
- [x] **Monto Inicial en Cero:** La celda inicia en `0.00` para que el digitador escriba la cantidad limpia.
- [x] **Desvinculación Remitente-Destinatario:** El remitente ya no está atado a un único beneficiario histórico; se puede buscar en el directorio o registrar uno nuevo.
- [x] **Lógica de Comisiones Automáticas:**
  - **En Caja de Depósito:** Suma la comisión al valor a pagar por el cliente.
  - **En Caja de Retiro:** Descuenta la comisión del valor neto a recibir.
- [x] **Formas de Pago en Emisión:**
  - **Efectivo en Ventanilla:** Registra la recepción de efectivo y series de billetes altos.
  - **Transferencia Bancaria:** Selector de banco, número de operación y carga de foto/comprobante.
- [x] **Verificación Obligatoria de Transferencia Bancaria en Cuenta:**
  - Tarjeta de confirmación con checkbox y botón interactivo.
  - Bloqueo obligatorio: No se permite cotizar ni generar el Código Único de VALEX si el cajero no marca que validó los fondos en la banca móvil de VALEX.
- [x] **Aumento Automático en Tesorería:** Al pagar por transferencia bancaria, el saldo en `1010-EC Banco Pichincha` o `1010-PE BCP` aumenta automáticamente.

### 4. 📊 Panel General y Control Operativo (`/dashboard`)
- [x] **Desglose de Recaudación:**
  - **💵 Enviado en Efectivo:** Monto total en USD y PEN recaudado en ventanilla física y número de giros.
  - **🏦 Enviado por Transferencia:** Monto total en USD y PEN depositado en cuentas bancarias y número de giros.
- [x] **Desglose de Comisiones VALEX:** Total acumulado en USD y PEN, más el margen generado hoy.
- [x] **Arqueo de Fondos en Tiempo Real:**
  - **🏧 Bóvedas Físicas:** Saldo disponible en Caja Ecuador (`USD`) y Caja Perú (`PEN`).
  - **🏦 Cuentas Bancarias:** Saldo disponible en Banco Pichincha, Banco Guayaquil y BCP.
- [x] **Desglose por Forma de Retiro / Entrega:** Volumen de pagos en Efectivo, Yape y Cuenta Bancaria.
- [x] **Volumen Bilateral por Corredor:** `Ecuador 🇪🇨 → Perú 🇵🇪` y `Perú 🇵🇪 → Ecuador 🇪🇨`.
- [x] **Trazabilidad y Auditoría en Vivo:** Registro de eventos por usuario, fecha y entidad.

### 5. Módulo de Comisiones por Tramos en Soles (`/fees`)
- [x] **Tabla Dinámica y Escalonada por Tramos en Soles (PEN):**
  - **1 a 500 soles:** $1.00 USD
  - **501 a 1,000 soles:** $2.00 USD
  - **1,001 a 2,000 soles:** $3.00 USD
  - **2,001 a 5,000 soles:** $4.00 USD
  - **5,001 a 10,000 soles:** $5.00 USD
  - **Más de 10,000 soles:** $6.00 USD (configurable)
- [x] **Panel Web CRUD Completo:** Creación, edición, activación/desactivación y eliminación de tramos en vivo.
- [x] **Simulador Interactivo:** Cálculo en tiempo real de equivalencia en soles, tramo aplicado, comisión y neto a entregar.

### 7. 📲 Notificaciones Inteligentes por WhatsApp (Web + Móvil)
- [x] **Comprobante al Beneficiario (Destinatario):** Enlace directo con texto pre-formateado que incluye el monto exacto a cobrar en destino, nombre del remitente y el **Código Único de VALEX** para retiro en ventanilla.
- [x] **Ticket de Emisión al Remitente:** Enlace con desglose de montos, comisión cobrada, referencia y código emitido.
- [x] **Constancia de Entrega / Pago:** Al confirmar el cobro en `/payout`, se habilita el botón para enviar inmediatamente la constancia de que el dinero fue entregado al beneficiario.
- [x] **Disponibilidad Total:** Presente en la emisión (`/transfer/new`), ficha de detalle (`/transfers/detail`), caja de retiro (`/payout`) y en la aplicación móvil APK.

### 8. 📱 Aplicación Móvil Android (`com.valex.app`) para Operadores
- [x] **Modo Operador de Ventanilla:** Reconocimiento de roles `ADMIN`, `CASHIER` y `SUPERVISOR` al iniciar sesión.
- [x] **Acceso Directo a Emisión y Giros:** Emisión inmediata de nuevos VALEX y consulta de giros desde el celular.
- [x] **Compilación Release:** Binario `VALEX.apk` actualizado y disponible para descarga en `/downloads/VALEX.apk`.

### 9. 🚚 Traslado Físico de Fondos de Frontera (Cross-Border Cash Transport)
- [x] **Compensación Macará 🇪🇨 ↔ Sullana/Aguas Verdes 🇵🇪:** Módulo de traspaso entre cajas físicas transfronterizas para trasladar dólares acumulados en Ecuador hacia soles necesarios en Perú sin intermediarios bancarios internacionales.

---

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

# PROJECT_MASTER_SPEC_v1

**Proyecto:** Plataforma fintech de remesas y cambio de divisas Ecuador ↔ Perú
**Versión:** 1.0
**Estado:** Documento maestro (fuente de verdad del proyecto)

> Este documento es la referencia definitiva del proyecto. Ninguna sesión de trabajo debe perder este contexto.
> Desde aquí se deriva el plan: Concepto → modelo operativo → arquitectura → diseño técnico → MVP → desarrollo → pruebas → piloto.

---

## 1. Resumen ejecutivo

El proyecto consiste en crear una empresa fintech especializada inicialmente en transferencias de dinero y cambio de divisas entre Ecuador y Perú, combinando una experiencia digital mediante aplicaciones móviles con una operación física mediante oficinas propias.

La propuesta no será simplemente una aplicación para "cambiar dólares por soles". El sistema debe gestionar de extremo a extremo una operación financiera:

**identificación → cotización → creación de transferencia → recepción del dinero → conciliación → controles de riesgo/AML → liquidación → entrega al beneficiario → contabilidad → auditoría.**

El modelo inicial contempla dos centros operativos:

```
                EMPRESA
                   │
        ┌──────────┴──────────┐
        │                     │
    ECUADOR                 PERÚ
     Oficina                Oficina
       │                      │
    Caja USD               Caja PEN
       │                      │
 Banco Ecuador           Banco Perú
```

El cliente podrá iniciar una operación:
- desde la aplicación;
- desde la oficina.

Y podrá pagar:
- mediante transferencia bancaria;
- en efectivo.

El beneficiario podrá recibir:
- transferencia a cuenta bancaria;
- retiro en efectivo en nuestra oficina;
- posteriormente, billetera móvil como Yape, sujeto a la viabilidad operativa/regulatoria de la integración.

El beneficiario no necesita necesariamente ser usuario de la plataforma.

Este modelo tiene precedentes claros. MoneyGram, por ejemplo, combina retiro de efectivo, cuenta bancaria y billetera móvil; para cash pickup utiliza identificación y un número de referencia. Global66 también opera Ecuador y Perú, muestra cotización/costo antes de confirmar y permite enviar a beneficiarios que no necesariamente tienen cuenta Global66.

---

## 2. La visión del proyecto

La visión que recomiendo para los socios es:

> **Construir una plataforma de remesas regional que haga que enviar dinero entre Ecuador y Perú sea tan sencillo como realizar una transferencia bancaria local, pero con la seguridad, trazabilidad y control financiero de una institución fintech.**

La ventaja competitiva no debería ser únicamente: "Tenemos una aplicación." Eso es fácil de copiar.

La verdadera ventaja debe ser la combinación de:

1. **Precio competitivo** — Tipo de cambio de mercado + spread controlado + comisión transparente.
2. **Rapidez** — Procesamiento eficiente y estados claros.
3. **Omnicanalidad** — App + Oficina.
4. **Flexibilidad** — Banco + Efectivo + futuro: billeteras.
5. **Confianza** — El cliente puede ver exactamente: cuánto envía; cuánto paga; qué tipo de cambio recibe; cuánto recibe el beneficiario; estado de la operación.
6. **Atención humana** — Una oficina física puede ser una ventaja importante frente a una fintech exclusivamente digital.

---

## 3. Qué problema estamos resolviendo

Actualmente una persona que necesita enviar dinero entre Ecuador y Perú puede encontrarse con:
- diferentes tipos de cambio;
- comisiones poco transparentes;
- procesos bancarios complicados;
- necesidad de acudir físicamente a determinados operadores;
- aplicaciones que no aceptan efectivo;
- aplicaciones que no ofrecen cash pickup propio;
- falta de soporte humano;
- incertidumbre sobre dónde está el dinero;
- problemas cuando el beneficiario no tiene cuenta en la plataforma.

Nuestro producto busca unificar: CAMBIO + REMESA + PAGO + EFECTIVO + BANCO + TECNOLOGÍA + ATENCIÓN HUMANA en una única operación.

---

## 4. Alcance confirmado del proyecto

**Países iniciales:** Ecuador ↔ Perú.

No incluiremos inicialmente: Colombia; Venezuela; otros países.

Pero la arquitectura será preparada para agregarlos posteriormente.

---

## 5. Monedas iniciales

- Ecuador: **USD**
- Perú: **PEN**

Por tanto:
- EC → PE : USD → PEN
- PE → EC : PEN → USD

La plataforma debe estar preparada para agregar nuevas monedas posteriormente.

---

## 6. Usuarios del sistema

Existirán dos tipos principales.

**Persona natural**
- Ejemplo: Juan Pérez — Cédula ecuatoriana

**Empresa**
- Ejemplo: IMPORTADORA ABC S.A. — RUC — Representante legal — Usuarios autorizados

Aunque recomiendo que el lanzamiento comercial inicial se concentre principalmente en personas naturales, la arquitectura debe soportar empresas desde el principio.

---

## 7. Beneficiarios

Una de las decisiones importantes ya resueltas:

> **El beneficiario NO necesita tener cuenta en nuestra plataforma.**

```
Juan (Ecuador)
   │
   │ $500
   ▼
Nuestra plataforma
   │
   ▼
María (Perú)
```

María puede: tener cuenta; no tener cuenta; retirar en oficina; recibir en banco; posteriormente recibir mediante billetera.

Este patrón está alineado con productos existentes. Global66 señala que el beneficiario no necesita una cuenta Global66 para recibir el envío.

---

## 8. Métodos de entrada de dinero

### A. Transferencia bancaria

```
Juan
   ↓
Banco Ecuador
   ↓
Cuenta bancaria de nuestra empresa
   ↓
Conciliación
   ↓
Transferencia
```

El usuario:
1. crea la operación;
2. recibe instrucciones de pago;
3. realiza la transferencia;
4. adjunta comprobante cuando corresponda;
5. el sistema espera confirmación;
6. se concilia;
7. se libera la operación.

Global66 utiliza actualmente un flujo similar en Ecuador para determinadas cargas: transferencia, comprobante y posterior abono. También establece controles sobre pagos de terceros y coincidencia de monto.

### B. Pago en efectivo

```
Juan
 ↓
Oficina Ecuador
 ↓
Identificación
 ↓
Crear operación
 ↓
Cotización
 ↓
Confirmación
 ↓
Recepción de efectivo
 ↓
Registro de caja
```

> **La operación debe existir en el sistema antes de registrar definitivamente la recepción del dinero. Esto es fundamental.**

No quiero:
```
Empleado recibe $500
↓
guarda el dinero
↓
después registra
```

Sino:
```
Crear operación
↓
Confirmar condiciones
↓
Recibir dinero
↓
Registrar CASH-IN
```

---

## 9. Métodos de salida

**Primera etapa:**
- Transferencia bancaria — Nuestra cuenta bancaria Perú → Cuenta bancaria beneficiario
- Efectivo — Nuestra caja Perú → Beneficiario

**Segunda etapa:**
- Yape / billetera móvil

La arquitectura se preparará desde el inicio para soportarlo. No recomiendo que Yape sea una dependencia estructural del sistema. Debe ser simplemente un `PayoutMethod`.

---

## 10. Flujo completo de una transferencia

Supongamos: Juan está en Ecuador. Quiere enviar USD 500 a María en Perú.

### Paso 1 — Juan inicia operación
Desde la app: "Enviar dinero". Selecciona: Origen: Ecuador; Destino: Perú.

### Paso 2 — Introduce monto
Envías: USD 500. El sistema consulta el motor de FX. Por ejemplo, hipotéticamente: Mercado 1 USD = 3.5200 PEN; Tipo aplicado 1 USD = 3.4900 PEN.

### Paso 3 — Comisión
Ejemplo hipotético: Monto USD 500; Comisión USD 4; Tipo de cambio 3.4900; Beneficiario recibe PEN 1,745. El usuario debe poder ver todo antes de confirmar.

### Paso 4 — Elige beneficiario
María Pérez — DNI: XXXXXXXX — Teléfono: XXXXXXXX. Puede seleccionar: Recibir en banco (Banco, CCI, Tipo de cuenta, Moneda, Titular) o Retirar efectivo (Oficina Perú) o posteriormente Yape (Número móvil).

### Paso 5 — El sistema genera la cotización
La cotización debe tener una vigencia. Ejemplo: USD 500; 1 USD = 3.4900 PEN; Válida: 05:00 minutos. Si el cliente no confirma/paga: `QUOTE_EXPIRED` y se genera una nueva cotización. Esto protege al negocio de movimientos del tipo de cambio.

### Paso 6 — Creación de transferencia
Se genera: `TRX-7K4P92MX` (Transaction Reference). Internamente existirá un UUID que no tiene que ser mostrado al cliente.

### Paso 7 — Código de retiro
Si se eligió efectivo, el sistema genera automáticamente un código: `RX7K-92PM-4Q8T`. Recomendado: 12 caracteres; alfanumérico; aleatorio criptográficamente; no creado por el usuario; de un solo uso; con expiración; límite de intentos; invalidación automática después del pago. No se llamará "PIN"; se llamará **Código de retiro**. El Transaction Reference y el código de retiro son cosas diferentes.

### Paso 8 — Pago
Juan puede: Opción A) Transferir desde su banco; Opción B) Acudir a nuestra oficina y entregar efectivo.

### Paso 9 — Regla: no aceptar pagos de terceros por defecto
Ejemplo: Operación Juan Pérez; Pago Juan Pérez → correcto. Pero Operación Juan Pérez; Pago Carlos Pérez → debe ir a `PAYMENT_MISMATCH` y revisión. La política exacta deberá definirse con Compliance/Legal.

### Paso 10 — Conciliación
El sistema debe determinar: ¿Llegó el dinero? ¿Quién lo envió? ¿Cuánto? ¿A qué operación corresponde? ¿El monto coincide? ¿La cuenta corresponde al cliente? Resultado: `MATCHED`, `MISMATCH` o `MANUAL_REVIEW`.

### Paso 11 — Risk / AML
Antes de ejecutar el payout: KYC + Risk + AML + reglas internas. Ejemplo: Risk Score = 18 → LOW → continúa. Risk Score = 85 → HIGH → revisión.

### Paso 12 — Settlement
La empresa realiza la liquidación entre Ecuador y Perú. No necesariamente cada transferencia individual debe provocar una transferencia internacional entre nuestras cuentas. Esto dependerá del modelo de tesorería. Por eso necesitamos manejar liquidez local.

```
ECUADOR
Banco USD
Caja USD
      │
      ▼
TREASURY
      │
      ▼
PERÚ
Banco PEN
Caja PEN
```

### Paso 13 — Payout
Si es banco: Cuenta empresa Perú → Cuenta beneficiario. Si es efectivo: Caja Perú → Beneficiario.

### Paso 14 — Cash pickup
María llega a nuestra oficina. Presenta: Documento + Código de retiro. El empleado verifica: Transferencia existe; Código válido; Código no usado; Beneficiario coincide; Documento coincide; Operación aprobada; No está bloqueada; No está pagada. Después: `CASH_OUT` → Firma/confirmación → Código invalidado → `TRANSFER = PAID`.

---

## 11. Estados de una transferencia

Este será uno de los elementos más importantes del sistema.

**Flujo principal:**
```
DRAFT
   ↓
QUOTED
   ↓
CONFIRMED
   ↓
AWAITING_PAYMENT
   ↓
PAYMENT_RECEIVED
   ↓
RECONCILIATION
   ↓
RISK_CHECK
   ↓
APPROVED
   ↓
SETTLEMENT_PENDING
   ↓
PAYOUT_PROCESSING
   ↓
PAID
   ↓
COMPLETED
```

**Estados excepcionales:**
```
QUOTE_EXPIRED
PAYMENT_MISMATCH
PAYMENT_EXPIRED
MANUAL_REVIEW
AML_REVIEW
RISK_BLOCKED
PAYOUT_FAILED
PAYOUT_REJECTED
CANCELLED
REFUND_PENDING
REFUNDED
```

Esto permitirá que el sistema explique exactamente dónde está el dinero.

---

## 12. Aplicación móvil del cliente

La app debe ser sencilla. No queremos construir un "banco digital" lleno de funcionalidades.

**Pantalla principal:**
```
Hola Juan

Enviar dinero
Ecuador → Perú

-------------------

Últimas operaciones

TRX-7K4P92MX
USD 500 → PEN 1,745
Completada

TRX-81K2P...
USD 200 → PEN 698
En proceso
```

**Menú principal:** Inicio; Enviar; Beneficiarios; Operaciones; Perfil; Ayuda.

No agregaríamos inicialmente: inversiones; tarjetas; préstamos; wallet; criptomonedas; marketplace.

**Flujo "Enviar":**
- Pantalla 1: Desde: Ecuador / Hacia: Perú
- Pantalla 2: ¿Cuánto quieres enviar? USD ______
- Pantalla 3: Cotización — Envías: USD 500 / Comisión: USD 4 / Tipo: 3.4900 / Recibe: PEN 1,745
- Pantalla 4: Beneficiario
- Pantalla 5: ¿Cómo recibirá? ○ Banco ○ Efectivo ○ Yape
- Pantalla 6: ¿Cómo pagarás? ○ Transferencia bancaria ○ Efectivo en oficina
- Pantalla 7: Resumen / Confirmar

**Seguimiento de operación (tracking):**
```
TRX-7K4P92MX

✓ Operación creada
✓ Pago recibido
✓ Pago verificado
✓ Operación aprobada
✓ Dinero enviado
✓ Beneficiario pagado
```

**Notificaciones:** Operación creada; Pago pendiente; Pago recibido; Pago verificado; Operación en revisión; Operación aprobada; Dinero enviado; Beneficiario cobró; Operación completada; Problema. Canales: Push; correo; SMS/WhatsApp cuando sea conveniente y jurídicamente apropiado.

---

## 13. Consola de caja (Cashier Console)

Aplicación web separada. El cajero NO debe tener acceso al mismo panel administrativo que el gerente.

```
CAJA PERÚ

Empleado: Ana López
Caja: MAIN-PEN-01
Saldo inicial: S/ 50,000

--------------------------------

Operaciones

Buscar transferencia

Código: [____________]
[VALIDAR]
```

**Pantalla de retiro:**
```
CASH PICKUP

Referencia: TRX-7K4P92MX
Beneficiario: María Pérez
Documento: DNI XXXXX
Monto: S/ 1,745
Estado: READY FOR PICKUP

[PROCESAR RETIRO]
```
Después: Confirmar identidad → [CONFIRMAR] → Monto entregado: S/ 1,745 → [FINALIZAR]

**Funciones del cajero (podrá):** crear operaciones para clientes; registrar clientes; verificar documentos; recibir efectivo; entregar efectivo; consultar operaciones; imprimir recibos; abrir caja; cerrar caja; hacer arqueo; registrar incidencias.

**No podrá:** cambiar libremente el tipo de cambio; borrar operaciones; eliminar movimientos; modificar el ledger; desbloquear AML; aprobar operaciones de alto riesgo; cambiar permisos.

---

## 14. Separación de funciones

```
CAJERO        → OPERACIONES
SUPERVISOR    → APROBACIONES
COMPLIANCE    → AML / KYC / RISK
TREASURY      → LIQUIDEZ / FX
ADMIN         → CONFIGURACIÓN
```

Una persona no debería poder hacer todo.

---

## 15. Apertura y cierre de caja

La caja tendrá: `OPENING_BALANCE`. Después: `CASH_IN`, `CASH_OUT`, `ADJUSTMENT`. Al final: `EXPECTED_BALANCE` y `ACTUAL_BALANCE`.

Ejemplo:
```
Esperado: S/ 250,000
Contado:  S/ 249,900
Diferencia: -S/ 100
```

El sistema crea `CASH_DISCREPANCY` y exige explicación/aprobación.

---

## 16. Consola administrativa / Backoffice

Módulos:

- **Dashboard** — Operaciones hoy; Volumen USD; Volumen PEN; Ingresos; Comisiones; Spread; Operaciones pendientes; Alertas AML; Alertas fraude; Caja Ecuador; Caja Perú; Liquidez bancaria.
- **Clientes** — Buscar cliente; Ver perfil; Ver KYC; Ver documentos; Ver operaciones; Ver beneficiarios; Ver dispositivos; Ver alertas; Ver casos. Con controles de privacidad.
- **Operaciones** — Buscar por: número de operación; cliente; beneficiario; documento; monto; fecha; país; estado; método de pago; método de payout.
- **Compliance** — KYC; AML; Risk; Alertas; Casos; Documentos; Revisiones; Bloqueos. Ejemplo: CASE #92812 — Cliente Juan Pérez — Risk HIGH — Motivos: patrón inusual, nuevo beneficiario, monto superior al habitual — Estado MANUAL REVIEW.
- **Treasury** — Ecuador (Banco USD 500,000; Caja USD 50,000; Disponible USD 550,000); Perú (Banco PEN 1,500,000; Caja PEN 200,000; Disponible PEN 1,700,000); Transferencias pendientes; Pagos próximos; Liquidez mínima; Necesidad de fondeo; Exposición FX.
- **Conciliación** — Recibe extracto bancario y compara Banco vs Sistema. Banco $500 / Sistema TRX-123 $500 → MATCH ✓. Banco $500 / Sistema $450 → discrepancia.

---

## 17. Ledger financiero

Arquitectura de **double-entry ledger**. No almacenar simplemente `balance = 100000` y modificarlo. El sistema debe registrar movimientos.

Ejemplo de cuentas: Banco Ecuador DEBIT/CREDIT; Caja Ecuador DEBIT/CREDIT; Ingresos por comisión DEBIT/CREDIT; FX DEBIT/CREDIT; Settlement DEBIT/CREDIT.

El concepto de ledger de doble partida es utilizado en infraestructura fintech open source como Blnk.

---

## 18. Arquitectura general

**Modular Monolith**, no microservicios. No comenzar con 20 microservicios, Kafka, Kubernetes, Service Mesh, gRPC. El negocio todavía está validándose.

```
                    CLIENTES
                       │
             ┌─────────┴─────────┐
             │                   │
          MOBILE              WEB
             │                   │
             └─────────┬─────────┘
                       │
                    API/BFF
                       │
                APPLICATION CORE
                       │
      ┌────────────────┼────────────────┐
      │                │                │
   Transfer          Customer          KYC
      │                │                │
   Payment            Risk             AML
      │                │                │
   Payout             FX              Ledger
      │                │                │
   Treasury      Reconciliation      Audit
                       │
                    PostgreSQL
```

**¿Por qué Modular Monolith?** Desarrollo más rápido; transacciones ACID; menor complejidad; debugging más simple; costes bajos; despliegue fácil. Módulos bien separados internamente. Posteriormente se podrán extraer: Risk, AML, Notifications, Payout, FX, Ledger, si realmente se necesita.

**Módulos lógicos:** Identity, Customer, KYC, Beneficiary, Quote, FX, Fee, Transfer, Payment, Reconciliation, Risk, AML, Payout, Settlement, Ledger, Treasury, Cash, Notification, Support, Audit, Administration.

---

## 19. Base de datos

**PostgreSQL** como núcleo transaccional.

Entidades principales:
```
users
customers
businesses
documents
beneficiaries
beneficiary_accounts

countries
currencies
corridors

quotes
fx_rates
fee_rules

transfers
transfer_events

payments
payment_matches

payouts
settlements

ledger_accounts
ledger_entries

bank_accounts
bank_transactions

cash_accounts
cash_movements

risk_assessments
risk_alerts

aml_cases
aml_alerts

offices
cash_sessions

notifications
audit_logs
```

---

## 20. Seguridad

Esta aplicación manejará: documentos de identidad; información bancaria; teléfonos; direcciones; operaciones financieras; datos de empresas.

La seguridad debe formar parte del diseño inicial. Tomar **OWASP MASVS** como referencia para las aplicaciones móviles (almacenamiento, autenticación, criptografía, comunicaciones, privacidad, resistencia contra manipulación).

**Autenticación:** Email/teléfono + password/passkey + MFA. Para operaciones sensibles: **Step-up authentication** (nuevo dispositivo + nuevo beneficiario + monto elevado → verificación adicional).

**Seguridad del backend:** Nunca confiar en la app móvil para decisiones críticas. El backend decide. Todas las operaciones financieras deben validarse server-side.

**Idempotencia:** Si el cliente pulsa CONFIRMAR dos veces, no podemos enviar el dinero dos veces. Cada operación crítica tendrá `idempotency_key`.

**Auditoría:** No se debe borrar información financiera. AUDIT LOG:
```
12:01  Usuario: operator_129
Acción: CHANGE_TRANSFER_STATUS
Anterior: REVIEW
Nuevo: APPROVED
IP: ...  Device: ...
```

---

## 21. Puntos fuertes del proyecto

1. **Modelo híbrido** — App + oficina capta usuarios digitales y personas que prefieren efectivo.
2. **Confianza** — Oficinas físicas responden a "¿Dónde está la empresa?".
3. **Transparencia** — Mostrar tipo de cambio + comisión + monto final + tiempo estimado.
4. **Flexibilidad** — Banco o efectivo; posteriormente Yape.
5. **Arquitectura regional** — Con un buen motor de corredores (EC→PE, PE→EC) se pueden agregar mañana EC→CO, PE→CO, CO→PE sin reconstruir el sistema.
6. **Conocimiento local** — Atención en español; oficinas; usuarios locales; horarios adaptados; métodos locales; soporte humano; necesidades de migrantes/familias/negocios.

---

## 22. Puntos débiles

1. **Regulación** (mayor riesgo). En Ecuador, el Banco Central establece un Sistema Auxiliar de Pagos con servicios autorizados para transferencias de recursos y remesas, y mantiene un catastro de partícipes autorizados. En Perú existe regulación específica para Empresas de Transferencia de Fondos bajo supervisión de la SBS (Resolución SBS 1025-2005). No asumir que una empresa común puede operar sin autorización o un partner regulado.
2. **Liquidez** — Si enviamos USD→PEN necesitamos suficiente PEN en Perú; el corredor inverso genera USD. Se necesita Treasury Management.
3. **Riesgo cambiario** — El tipo de cambio puede moverse entre cotización y settlement. Se necesitan: cotización con expiración; límites; spread; reservas; treasury; exposición máxima.
4. **Efectivo** — Riesgo de robo, pérdida, fraude interno, errores de caja, costos operativos, seguridad física, transporte, seguros, arqueos. La caja debe tratarse como componente financiero.
5. **Fraude** — Cuentas robadas; documentos falsos; cuentas bancarias de terceros; beneficiarios falsos; fraude interno; retiro fraudulento; ingeniería social; dispositivos comprometidos. Risk + AML + KYC no pueden ser un añadido posterior.
6. **Competencia** — Global66 (70+ países), MoneyGram (red global de cash pickup), Wise (transparencia). No intentar ganar por tamaño; ganar por corredor, servicio, confianza, precio y experiencia local.

---

## 23. Lo que dicen los usuarios

Usuarios peruanos mencionan repetidamente Global66, Wise, Remitly y otras alternativas. Comentarios positivos sobre rapidez y precio; experiencias negativas relacionadas con esperas y soporte. Señal útil, no una encuesta representativa.

**Conclusión:** El producto debe optimizar cuatro cosas: PRECIO, RAPIDEZ, CONFIANZA, SOPORTE.

---

## 24. Oportunidad competitiva

> "La forma sencilla y transparente de enviar dinero entre Ecuador y Perú, con la opción de hacerlo digitalmente o personalmente en una oficina."

No: "Somos otro banco." Ni: "Somos otra wallet."

---

## 25. Plan de construcción (fases)

| Fase | Objetivo |
|------|----------|
| 0 | Legal y modelo operativo |
| 1 | Modelo financiero |
| 2 | Diseño de procesos operativos |
| 3 | PRD |
| 4 | Diseño UX/UI |
| 5 | Arquitectura técnica |
| 6 | Núcleo financiero |
| 7 | Ledger |
| 8 | Backoffice |
| 9 | App móvil |
| 10 | Cashier |
| 11 | Integraciones (bancos) |
| 12 | Risk / AML |
| 13 | QA / Security |
| 14 | Sandbox |
| 15 | Piloto controlado |
| 16 | Soft launch |
| 17 | Escalamiento |

**Fase 0 — Legal y modelo operativo:** estructura societaria (Ecuador, Perú), licencias, permisos, partners, requisitos AML, KYC, límites, tratamiento del efectivo, cuentas bancarias, protección de fondos, contratos. Resultado: `LEGAL/REGULATORY BLUEPRINT`.

**Fase 1 — Modelo financiero:** modelo en Excel/Sheets con 100/500/1,000 operaciones por día. Variables: ticket promedio, comisión, spread, FX, costos bancarios, costos de oficina, personal, fraude, AML, liquidez. Resultado: Gross margin, Net margin, Break-even. Antes de escribir código.

**Fase 2 — Procesos operativos:** documentar EC→PE y PE→EC para cada combinación (Cash→Bank, Cash→Cash, Bank→Bank, Bank→Cash). Cada combinación con estados, responsables, tiempos, errores, conciliación, reversos, reembolsos.

**Fase 3 — PRD:** Personas, Empresas, Beneficiarios, KYC, Cotización, Transferencias, Pagos, Cash, Payout, FX, Fees, AML, Risk, Treasury, Ledger, Backoffice. Contrato entre socios, producto, diseño, desarrollo y QA.

**Fase 4 — UX/UI:** App cliente (registro, login, KYC, home, enviar, beneficiarios, cotización, pago, tracking, historial, perfil); Cashier Console (login, caja, clientes, creación, cash-in, cash-out, cierre); Backoffice (dashboard, operaciones, clientes, compliance, treasury, conciliación, configuración, auditoría).

**Fase 5 — Arquitectura técnica:** Frontend, Backend, Database, Cloud, Security, CI/CD, Monitoring, Logging, Backups, Disaster Recovery.

**Fase 6 — Núcleo financiero:** Identity, Customer, Beneficiary, Quote, Transfer, Payment, Payout, Ledger, Cash, Reconciliation, Audit. El corazón del sistema.

**Fase 7 — Ledger:** Double Entry; Atomic transactions; Idempotency; Concurrency; Audit trail; Reconciliation; Multi-currency. No permitir `UPDATE balance = balance + 500` sin el registro financiero correspondiente.

**Fase 8 — Backoffice:** Operations, Compliance, Cash, Treasury, Reconciliation. El personal interno debe poder operar el negocio aunque la app móvil todavía sea básica.

**Fase 9 — App móvil:** Registro, KYC, Cotización, Beneficiario, Transferencia, Pago, Tracking, Historial.

**Fase 10 — Cashier:** Apertura caja, Creación operación, Cash-in, Cash-out, Arqueo, Cierre.

**Fase 11 — Integraciones:** Banco Ecuador, Banco Perú, KYC provider, Identity verification, SMS, Email, Push, WhatsApp, y posteriormente Yape/wallet (si el modelo de integración autorizado lo permite).

**Fase 12 — Risk / AML:** Inicialmente reglas determinísticas (monto, frecuencia, nuevo beneficiario, nuevo dispositivo, múltiples cuentas, patrones anormales). Después modelos estadísticos/ML. No recomiendo empezar con IA; primero datos limpios, reglas, historial, labels.

**Fase 13 — Testing:** Unit; Integration (banco → backend → ledger); End-to-end (cliente → transferencia → pago → settlement → payout); Security (OWASP, penetration testing, API security, mobile security, access control); Financial (duplicados, reintentos, timeouts, rollback, concurrencia, payout duplicado, conciliación).

**Fase 14 — Sandbox:** EC→PE y PE→EC con dinero ficticio; probar 10,000 operaciones incluyendo errores.

**Fase 15 — Piloto controlado:** 1 oficina Ecuador + 1 oficina Perú + grupo limitado de usuarios. Medir: tiempo promedio, tasa de éxito, tasa de errores, fraude, costo por operación, margen, reclamos, diferencias de caja, liquidez.

**Fase 16 — Soft launch:** 100 → 500 → 1,000 → 5,000 usuarios. No escalar publicidad agresivamente hasta comprobar que la operación financiera funciona.

**Fase 17 — Escalamiento:** Yape, más bancos, más oficinas, más agentes, nuevos corredores, y después Colombia y Venezuela.

---

## 26. Qué NO debe hacerse

- No comenzar por las pantallas. Primero: modelo financiero + procesos + estados + ledger.
- No comenzar con microservicios. Primero: modular monolith.
- No construir wallet. MVP: transaction-based.
- No agregar 10 países. Primero: EC ↔ PE.
- No integrar 20 bancos. Primero los bancos necesarios para validar el corredor.
- No permitir modificaciones arbitrarias de transacciones. Las operaciones financieras deben ser inmutables o corregidas mediante nuevas transacciones/eventos.

---

## 27. Métricas a controlar desde el primer día

- **Producto:** usuarios registrados; usuarios KYC; usuarios activos; transferencias por usuario; retención.
- **Operación:** tiempo de procesamiento; tiempo de payout; tasa de éxito.
- **Financiero:** volumen; comisión; spread; revenue; margen.
- **Riesgo:** fraude; AML alerts; false positives; chargebacks/reversos.
- **Caja:** cash in; cash out; diferencias.
- **Liquidez:** USD disponible; PEN disponible; reservado; forecast.

**KPI principal:** Transferencias completadas correctamente. Luego: `Completed transfers / Total transfers`. Queremos acercarnos a una operación altamente confiable.

---

## 28. Modelo de ingresos

1. **Comisión** (Fee).
2. **Spread FX** (Market rate − Customer rate).
3. **Servicios empresariales** — en una segunda etapa.

**Ejemplo económico conceptual:** USD 500. El negocio obtiene comisión $4 y spread $X, pero debe descontar banco, partner, payout, cash handling, fraude, compliance, operación. El indicador realmente importante es **Contribution Margin per Transfer**, no simplemente "cobramos $4".

---

## 29. Oportunidades futuras

**B2B** — Empresa Ecuador → Proveedor Perú; Empresa Perú → Proveedor Ecuador. Con múltiples usuarios, aprobación, límites, reportes, comprobantes, conciliación. Puede ser mucho más rentable que depender únicamente de pequeños envíos familiares.

**Corredores** — Una vez probado EC ↔ PE, la plataforma podría convertirse en Regional Remittance Infrastructure: CO, VE, CL, US, ES, solo cuando exista justificación comercial y regulatoria.

---

## 30. Evaluación general

- **Potencial:** ALTO
- **Complejidad operativa:** ALTA
- **Complejidad regulatoria:** MUY ALTA
- **Complejidad tecnológica:** ALTA

No porque necesitemos una app complicada, sino porque estamos construyendo una infraestructura donde un error de software puede convertirse en una pérdida real de dinero.

---

## 31. Recomendación estratégica más importante

No pensar: "Vamos a construir una app para enviar dinero."

Pensar: **"Vamos a construir una infraestructura financiera para operar un corredor de remesas."** La aplicación móvil es solamente una de sus interfaces.

```
                 CUSTOMER
                    │
                    ▼
                  APP
                    │
                    ▼
                TRANSFER
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
      KYC          RISK         AML
       │            │            │
       └────────────┼────────────┘
                    ▼
                   FX
                    │
                    ▼
                 PAYMENT
                    │
                    ▼
               RECONCILIATION
                    │
                    ▼
                  LEDGER
                    │
                    ▼
                TREASURY
                    │
                    ▼
                SETTLEMENT
                    │
                    ▼
                  PAYOUT
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
        BANK                CASH
                              │
                              ▼
                           OFFICE
```

---

## 32. Definición consolidada del proyecto

- **Proyecto:** plataforma fintech de remesas y cambio de divisas Ecuador ↔ Perú.
- **Modelo:** híbrido digital + presencial.
- **Oficinas iniciales:** una en Ecuador y una en Perú.
- **Caja:** una caja operativa por oficina inicialmente.
- **Monedas:** USD y PEN.
- **Origen:** Ecuador o Perú.
- **Destino:** Ecuador o Perú.
- **Entrada:** transferencia bancaria o efectivo.
- **Salida:** cuenta bancaria, efectivo y posteriormente billeteras móviles.
- **Usuarios:** personas naturales y empresas.
- **Beneficiarios:** pueden no ser usuarios registrados.
- **Cotización:** mercado + spread propio + comisión; temporalmente bloqueada.
- **Operaciones:** creadas desde app o por empleado en oficina.
- **Código:** generado automáticamente por el sistema; no lo crea el usuario.
- **Cash pickup:** documento + código + validaciones + registro de caja.
- **Horario:** no 24/7; la plataforma puede recibir solicitudes fuera de horario, pero el procesamiento estará sujeto al horario operativo.
- **Wallet:** fuera del MVP.
- **Colombia/Venezuela:** fuera del MVP, arquitectura preparada.
- **Arquitectura:** modular monolith inicialmente.
- **Base financiera:** double-entry ledger.
- **Componentes críticos:** Transfer, Ledger, Treasury, Settlement, Reconciliation, Risk, AML, KYC y Cash.
- **Backoffice:** operaciones, compliance, treasury, conciliación, clientes, configuración y auditoría.
- **Cashier Console:** operaciones de caja, cash-in, cash-out, apertura, cierre y arqueo.
- **Mobile App:** registro, KYC, cotización, beneficiarios, envío, pago, tracking e historial.
- **Seguridad:** MFA, RBAC, cifrado, auditoría, idempotencia, controles server-side y baseline OWASP.
- **Prioridad:** seguridad, trazabilidad, conciliación y exactitud financiera antes que cantidad de funcionalidades.

---

## 33. Decisiones que debemos resolver antes de código de producción

1. **Estructura regulatoria Ecuador/Perú** — licencia propia, partner regulado o modelo híbrido. Puede cambiar la arquitectura y el modelo operativo.
2. **Integraciones bancarias** — banco Ecuador; banco Perú; mecanismos de confirmación; APIs; archivos; webhooks; tiempos; límites; conciliación.
3. **Yape** — mecanismo real y autorizado para ejecutar el payout.
4. **Modelo de liquidez** — capital inicial necesario para que EC→PE y PE→EC funcionen sin quedarnos sin PEN o USD.

---

## 34. Siguiente recomendación

El siguiente trabajo debería ser un **"Documento de Arquitectura y Modelo Operativo v1"**, dividido en cuatro investigaciones:

1. Regulación Ecuador + Perú, con fuentes oficiales.
2. Benchmark profundo de Global66, MoneyGram, Western Union, Wise, Remitly, Taptap Send y otros competidores.
3. Modelo financiero y de liquidez del corredor Ecuador ↔ Perú.
4. Diseño técnico definitivo: arquitectura, módulos, base de datos, ledger, APIs, seguridad, infraestructura y roadmap de desarrollo.

---

## Anexo A — Plan de ejecución del proyecto (8 etapas)

| Etapa | Qué construiremos | Resultado |
|-------|-------------------|-----------|
| 0 | Organización del proyecto | Estructura y metodología |
| 1 | Modelo operativo | Cómo funciona realmente el negocio |
| 2 | Regulación | Qué podemos operar legalmente |
| 3 | Modelo financiero | Costos, ingresos, liquidez y capital |
| 4 | Arquitectura funcional | Módulos, usuarios, permisos y procesos |
| 5 | Arquitectura técnica | Backend, BD, APIs, seguridad |
| 6 | MVP | Primera versión construible |
| 7 | Desarrollo y pruebas | Software funcional |
| 8 | Piloto | Primera operación controlada |

## Anexo B — Alcance MVP (congelado)

- **Corredores:** Ecuador ↔ Perú
- **Monedas:** USD ↔ PEN
- **Entrada:** transferencia bancaria; efectivo en oficina
- **Salida:** transferencia bancaria; efectivo en oficina
- **Arquitectura preparada para billeteras, pero Yape NO forma parte del MVP**
- **Usuarios:** cliente persona natural; cliente empresa; beneficiario; cajero; supervisor; compliance; treasury; administrador
- **Canales:** App móvil; Cashier Console; Backoffice

## Anexo C — Regla: no programar todavía

Antes de escribir código de producción hay que responder cómo funciona una operación (cotización → beneficiario → método de pago → creación → pago → conciliación → KYC/Risk/AML → aprobación → settlement → payout → beneficiario → completada) y convertirla en procesos empresariales formales con excepciones.

## Anexo D — Primer documento real

`PROJECT_OPERATING_MODEL_v1` con: 1) Participantes; 2) Tipos de cliente; 3) Tipos de beneficiario; 4) Corredores; 5) Métodos de pago; 6) Métodos de payout; 7) Estados; 8) Reglas de negocio; 9) Excepciones.

## Anexo E — Orden de ejecución por bloques

- **BLOQUE A — Negocio:** 1) Modelo operativo; 2) Actores; 3) Productos; 4) Corredores; 5) Tarifas; 6) FX; 7) Reglas; 8) Excepciones.
- **BLOQUE B — Financiero:** 9) Modelo de ingresos; 10) Costos; 11) Liquidez; 12) Treasury; 13) Settlement; 14) Ledger.
- **BLOQUE C — Funcional:** 15) Módulos; 16) Usuarios; 17) Roles; 18) Permisos; 19) Estados; 20) Casos de uso.
- **BLOQUE D — Técnico:** 21) Arquitectura; 22) Dominio; 23) Base de datos; 24) APIs; 25) Seguridad; 26) Auditoría; 27) Infraestructura.
- **BLOQUE E — Construcción:** 28) Backend; 29) PostgreSQL; 30) Ledger; 31) APIs; 32) Backoffice; 33) Cashier; 34) App; 35) Integraciones.
- **BLOQUE F — Validación:** 36) Unit tests; 37) Integration tests; 38) Financial tests; 39) Security tests; 40) Sandbox; 41) Piloto.

## Anexo F — Tecnología (referencia inicial, no decisión definitiva)

- Mobile: Flutter o React Native
- Web: React / Next.js
- Backend: TypeScript/NestJS o Java/Spring Boot
- Database: PostgreSQL
- Cache: Redis
- Storage: Object Storage cifrado
- Infrastructure: AWS/GCP/Azure
- Observability: OpenTelemetry + monitoring/logging

> La tecnología definitiva NO debe decidirse antes que el diseño del dominio. Arquitectura agnóstica: BUSINESS → DOMAIN → APPLICATION → API → DATABASE.

## Anexo G — Primer MVP propuesto

- **Cliente:** Registro → Login → KYC → Crear beneficiario → Cotizar → Crear transferencia → Elegir método de pago → Pagar → Tracking → Historial.
- **Cajero:** Login → Abrir caja → Buscar/crear cliente → Crear transferencia → Cash-in → Buscar payout → Validar beneficiario → Cash-out → Cerrar caja.
- **Backoffice:** Dashboard; Clientes; Transferencias; KYC; Risk; AML; Conciliación; Treasury; Caja; Ledger; Auditoría; Configuración.

## Anexo H — BANK SANDBOX

No construiremos inicialmente integraciones reales con bancos. Primero un **BANK SANDBOX** que simule Bank Ecuador → Bank Transaction → Reconciliation → Payment MATCHED, y Bank Perú → Payout → PAID. Probar 10,000 operaciones ficticias antes de sustituir el sandbox por integraciones reales.

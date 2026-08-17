# PROJECT_OPERATING_MODEL_v1

**Proyecto:** Plataforma fintech de remesas y cambio de divisas Ecuador ↔ Perú
**Versión:** 1.0 (en construcción)
**Estado:** En revisión — se construye capítulo por capítulo con aprobación del socio entre cada uno
**Base:** `PROJECT_MASTER_SPEC_v1.md` (fuente de verdad)

> Regla del proyecto: no escribir código de producción hasta completar modelo operativo, modelo financiero, PRD y arquitectura.
> Las operaciones financieras son inmutables; las correcciones se hacen con nuevas transacciones/eventos, nunca borrando.

---

## Índice de capítulos

1. [Actores del sistema](#1-actores-del-sistema) — *en revisión (implementado en consolas)*
2. [Tipos de cliente](#2-tipos-de-cliente) — *en elaboración*
3. Tipos de beneficiario — *pendiente*
4. Productos y servicios — *pendiente*
5. Corredores — *pendiente*
6. Métodos de entrada — *pendiente*
7. Métodos de salida — *pendiente*
8. Flujo completo de una operación — *pendiente*
9. Estados y transiciones — *pendiente*
10. Reglas de negocio y excepciones — *pendiente*

---

# 1. Actores del sistema

> **Estado:** borrador para revisión — pendiente de aprobación.

## 1.1 Propósito de este capítulo

Definir quiénes intervienen en el sistema y qué pueden hacer y qué no pueden hacer. El principio rector es la **separación de funciones**: ninguna persona debe poder completar por sí sola una operación financiera sensible (crear, recibir, aprobar y pagar). Esto reduce fraude interno, errores y riesgo regulatorio.

## 1.2 Clasificación general de actores

Los actores se dividen en dos grandes grupos:

1. **Actores externos** — clientes y beneficiarios; interactúan con la plataforma o con las oficinas.
2. **Actores internos** — personal de la empresa; operan la plataforma (Cashier Console y/o Backoffice).

## 1.3 Actores externos

### 1.3.1 Cliente (persona natural)

Persona que envía dinero o solicita un cambio de divisas.

- Se identifica con documento de identidad (cédula ecuatoriana o DNI peruano, según país).
- Debe superar KYC antes de operar.
- Puede operar desde la app móvil o desde la oficina (asistido por el cajero).
- Puede tener beneficiarios a su nombre.

**Puede:** registrar cuenta, completar KYC, crear beneficiarios, cotizar, crear transferencias, elegir método de pago, pagar (transferencia bancaria o efectivo en oficina), consultar estados y hacer seguimiento, cancelar una operación antes de pago.

**No puede:** crear su propia tasa, modificar una cotización emitida, modificar estados de su transferencia, eliminar operaciones, aprobar su propio KYC/riesgo, recibir más de una vez la misma operación.

### 1.3.2 Cliente (empresa)

Persona jurídica que envía dinero (ej. IMPORTADORA ABC S.A.).

- Se identifica con RUC.
- Tiene representante legal y usuarios autorizados.
- Requiere documentación corporativa (KYC de empresa) y verificación del representante.

**Puede:** lo mismo que la persona natural, más gestionar usuarios autorizados con límites y aprobaciones (en fase B2B posterior).

**No puede:** lo mismo que la persona natural; además ningún usuario individual de la empresa puede aprobar operaciones que él mismo creó sin un segundo autorizado.

### 1.3.3 Beneficiario

Persona o empresa que recibe el dinero.

- **No necesita ser usuario de la plataforma** (decisión ya resuelta).
- Puede recibir por transferencia bancaria o retirar efectivo en oficina (cash pickup); posteriormente billetera móvil.
- En cash pickup se identifica con su documento y el código de retiro.

**Puede:** recibir el dinero, retirar en oficina presentando documento + código de retiro válido, consultar su retiro en caja.

**No puede:** modificar la operación, transferir el derecho a un tercero sin revisión, usar un código que no le pertenece, retirar un código ya usado/expirado.

## 1.4 Actores internos

### 1.4.1 Cajero

Personal de oficina que atiende operaciones de caja (efectivo) y asiste a clientes.

**Puede:**
- crear operaciones para clientes presenciales;
- registrar clientes y beneficiarios;
- verificar documentos de identidad;
- recibir efectivo (CASH-IN) — siempre sobre una operación ya creada y confirmada;
- entregar efectivo (CASH-OUT) — solo con validaciones superadas;
- consultar operaciones;
- imprimir recibos;
- abrir y cerrar caja;
- hacer arqueo de caja;
- registrar incidencias.

**No puede:**
- cambiar libremente el tipo de cambio;
- borrar operaciones ni movimientos;
- modificar el ledger;
- desbloquear AML;
- aprobar operaciones de alto riesgo;
- cambiar permisos;
- procesar un retiro sin validar código + documento + estado.

### 1.4.2 Supervisor

Personal de operaciones que supervisa al cajero y aprueba operaciones dentro de su nivel.

**Puede:** aprobar operaciones dentro de límites, resolver discrepancias menores, aprobar diferencias de caja dentro de umbrales, revisar incidencias, liberar operaciones en revisión de bajo riesgo.

**No puede:** aprobar operaciones de alto riesgo (eso es Compliance), modificar el ledger, cambiar tasas globales, desbloquear casos AML por sí solo.

### 1.4.3 Compliance

Responsable de AML / KYC / Risk.

**Puede:** revisar KYC, evaluar riesgo, gestionar alertas y casos AML, bloquear/desbloquear operaciones o clientes, requerir documentación adicional, decidir sobre operaciones de alto riesgo.

**No puede:** crear operaciones a nombre de clientes, tocar el dinero (caja), cambiar el tipo de cambio, eliminar historial. Sus decisiones quedan auditadas.

### 1.4.4 Treasury

Responsable de liquidez, FX y settlement.

**Puede:** gestionar saldos USD/PEN, definir/ajustar spread y tasas dentro de política, ejecutar o aprobar liquidaciones (settlement), monitorear exposición FX, gestionar fondeo.

**No puede:** operar caja de un cliente, aprobar casos AML, modificar operaciones de clientes. La cotización siempre pasa por el motor de FX con reglas definidas.

### 1.4.5 Administrador

Responsable de configuración técnica y administrativa del sistema.

**Puede:** gestionar permisos y roles, configurar parámetros (límites, horarios, comisiones base), gestionar oficinas/cajas/bancos, auditar accesos.

**No puede:** tomar decisiones financieras de operaciones individuales, aprobar KYC/AML, ejecutar pagos, modificar el ledger. (En la práctica el admin define el marco; no opera dentro de él.)

### 1.4.6 Auditor

Acceso de solo lectura para auditoría y revisión regulatoria.

**Puede:** consultar todo el historial, exportar reportes, ver auditoría completa.

**No puede:** modificar nada. (Solo lectura.)

## 1.5 Matriz de separación de funciones

| Capacidad | Cajero | Supervisor | Compliance | Treasury | Admin | Auditor |
|-----------|:------:|:----------:|:----------:|:--------:|:-----:|:-------:|
| Crear operación para cliente | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| CASH-IN / CASH-OUT | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Apertura/cierre/arqueo de caja | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Aprobar operación (bajo riesgo) | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Decidir caso AML / alto riesgo | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Definir spread / FX / settlement | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Configurar roles/permisos | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Ver auditoría / reportes | parcial | parcial | parcial | parcial | parcial | ✓ |
| Modificar ledger | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

> Nota: la matriz se refina en el Capítulo 10 (reglas de negocio) y en el PRD. Los permisos exactos (RBAC) se definen en la arquitectura funcional.

## 1.6 Reglas transversales de actores

1. Ningún actor interno toca directamente el ledger; solo el sistema registra asientos mediante operaciones autorizadas.
2. Un mismo usuario puede tener más de un rol, pero la separación de funciones impide combinaciones incompatibles (ej. cajero + compliance).
3. Toda acción de actores internos sobre una operación sensible queda en el audit log (quién, qué, cuándo, IP, dispositivo, valor anterior/nuevo).
4. Las decisiones de aprobación sobre operaciones de alto riesgo requieren mínimo dos personas de áreas distintas (regla four-eyes).

---

# 2. Tipos de cliente

> **Estado:** borrador para revisión — pendiente de aprobación. Coherente con el modelo de datos implementado (`CustomerType`, `DocumentType`, `kycStatus`).

## 2.1 Propósito de este capítulo

Definir los tipos de cliente que el sistema admite, cómo se identifican, qué documentación requieren y cómo se gestiona su ciclo de vida (registro → KYC → operación → bloqueos). El principio rector: **todo remitente se identifica de forma inequívoca y pasa por KYC antes de operar**.

## 2.2 Tipos de cliente

El sistema distingue dos tipos, modelados en el enum `CustomerType`:

| Código | Tipo | Quiénes | Documento de identificación |
|--------|------|---------|-----------------------------|
| `PERSON` | Persona natural | Remitentes individuales | Cédula (EC), DNI (PE), Pasaporte |
| `BUSINESS` | Empresa | Personas jurídicas (fase B2B) | RUC |

### 2.2.1 Persona natural (`PERSON`)

- Se identifica con un documento válido según su país de residencia (`CEDULA`, `DNI` o `PASSPORT`).
- El par (tipo de documento, número) es **único**: el sistema rechaza registrar un cliente duplicado.
- Puede crear uno o varios beneficiarios.
- Puede operar desde oficina (asistido por cajero) o desde la app móvil (fase posterior).

### 2.2.2 Empresa (`BUSINESS`)

- Se identifica con `RUC`.
- Requiere KYC corporativo (escritura, representante legal, estados financieros según monto) — se amplía en la fase B2B.
- En v1 el registro de empresas queda habilitado en el modelo de datos y en consolas, con flujo KYC igual que persona natural.

## 2.3 Tipos de documento soportados

| Código | Descripción | País |
|--------|-------------|------|
| `CEDULA` | Cédula de identidad | Ecuador |
| `DNI` | Documento Nacional de Identidad | Perú |
| `PASSPORT` | Pasaporte | Ambos |
| `RUC` | Registro Único de Contribuyentes | Ecuador (empresas) |

> Regla: el tipo de documento del remitente debe ser coherente con el país de residencia del corredor origen (ver Capítulo 5). La validación fina (checksum por país) se define en el PRD.

## 2.4 Ciclo de vida del cliente

```
Registro (PENDING) → KYC (APPROVED | REJECTED) → Operaciones
                                    └→ Bloqueo temporal (EXPIRED / manual)
```

### 2.4.1 Estados de KYC

| Estado | Significado | Efecto |
|--------|-------------|--------|
| `PENDING` | Registrado, KYC sin resolver | No puede cotizar ni crear transferencias |
| `APPROVED` | KYC aprobado por Compliance | Puede operar |
| `REJECTED` | KYC rechazado | No puede operar; puede apelar con documentación |
| `EXPIRED` | Documentación vencida | Requiere renovar KYC para seguir operando |

### 2.4.2 Reglas de KYC

1. El registro de un cliente no otorga derechos operativos por sí solo; el KYC debe estar `APPROVED`.
2. La aprobación/rechazo la decide exclusivamente Compliance (o Supervisor según política), nunca el cajero que registró al cliente.
3. La decisión se registra con `decision: APPROVE | REJECT` y queda en el audit log.
4. Los remitentes con riesgo alto no bloquean su registro, pero sus operaciones pasan a revisión (Capítulo 9).
5. El cliente duplicado se detecta por documento al momento del alta; el sistema lo indica en lugar de crear una copia.

## 2.5 Qué registra el sistema por cliente

- Datos de identidad: `type`, `fullName`, `documentType`, `documentNumber`.
- País de residencia (`countryId`) y contacto (`email`, `phone`).
- `kycStatus` actual y el historial de decisiones (audit).
- Relación con beneficiarios y con las transferencias en las que participa.

## 2.6 Interacción con otros capítulos

- Con **Capítulo 1**: solo el cajero/supervisor crea clientes; solo Compliance aprueba KYC.
- Con **Capítulo 3**: el beneficiario pertenece a un cliente, pero no es usuario del sistema.
- Con **Capítulo 9**: el estado de riesgo del cliente condiciona el flujo de sus operaciones.

---

> **Pendiente de aprobación del socio.** Una vez aprobados los Capítulos 1 y 2, continuamos con el Capítulo 3 (Tipos de beneficiario).

# 💱 Divisas — Sistema de Giros y Remesas Internacionales (Ecuador ↔ Perú)

Plataforma integral para el cambio y envío de divisas entre Ecuador (USD) y Perú (PEN), diseñada bajo los estándares normativos UAFE (Ecuador) y SBS (Perú), y benchmarks globales de la industria (Western Union, Wise, Global66).

---

## 🚀 Guía de Instalación Rápida en una Nueva Computadora

### 📋 Requisitos Previos
* **Node.js** v20 o superior
* **Docker Desktop** (para la base de datos PostgreSQL)
* **Git**

---

### 🛠️ Pasos de Instalación (5 Minutos)

#### 1. Clonar el Repositorio
```bash
git clone https://github.com/Danny3969/divisas.git
cd divisas
```

#### 2. Instalar Dependencias
```bash
# Backend NestJS
cd backend && npm install && cd ..

# Consola de Caja
cd apps/cashier && npm install && cd ../..

# Consola de Administración
cd apps/admin && npm install && cd ../..
```

#### 3. Configurar Variables de Entorno (`.env`)
```bash
cp backend/.env.example backend/.env
```

#### 4. Encender Base de Datos y Poblar Datos Demo
```bash
# Levantar PostgreSQL 16 con Docker Compose
docker compose up -d

# Sincronizar esquema e insertar datos iniciales (Bancos, Cajas, Usuarios)
cd backend
npx prisma db push
npm run seed
cd ..
```

#### 5. Ejecutar los Servicios
```bash
# Servidor Backend API (Puerto 3000)
cd backend && npm run start:dev

# Consola de Caja (Puerto 3001)
cd apps/cashier && npm run dev

# Consola de Administración (Puerto 3002)
cd apps/admin && npm run dev
```

---

## 🔐 Credenciales Demo para Pruebas

| Rol | Correo Electrónico | Contraseña | Consola Acceso |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@divisas.com` | `Divisas2026!` | Admin (`localhost:3002`) |
| **Cajero Ecuador** | `cajero.ec@divisas.com` | `Divisas2026!` | Caja (`localhost:3001`) |
| **Cajero Perú** | `cajero.pe@divisas.com` | `Divisas2026!` | Caja (`localhost:3001`) |
| **Supervisor** | `supervisor@divisas.com` | `Divisas2026!` | Admin (`localhost:3002`) |
| **Compliance** | `compliance@divisas.com` | `Divisas2026!` | Admin (`localhost:3002`) |

---

## 🌐 Opción Cero Instalaciones (GitHub Codespaces)
Puedes ejecutar todo el sistema en la nube desde cualquier navegador web sin instalar nada:
1. Ve a `https://github.com/Danny3969/divisas`.
2. Presiona la tecla **`.`** (punto) o haz clic en **Code $\rightarrow$ Codespaces $\rightarrow$ Create codespace**.

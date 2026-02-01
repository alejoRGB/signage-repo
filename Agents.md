# Agentes del Proyecto Digital Signage

Este archivo sirve como índice y mapa de los agentes de inteligencia artificial que trabajan en este proyecto. Debido a la complejidad del sistema, el trabajo se ha dividido en roles especializados.

> [!IMPORTANT]
> **Jerarquía Estricta:** Los agentes operativos (`Player`, `Front-End`, `Back-End`) **NO** colaboran directamente entre sí para realizar cambios cruzados. Todas las solicitudes que impliquen más de un dominio deben pasar por el `Agent Coordinator`.

## Estructura de Agentes

El proyecto está dividido en 3 áreas principales de responsabilidad, cada una manejada por un "Agente" especializado (representado por su archivo de documentación correspondiente):

### 1. Agente Player (`Player.md`)
- **Ubicación:** Raíz del proyecto / `player/`
- **Responsabilidad:** Desarrollo y mantenimiento del software que se ejecuta en los dispositivos Raspberry Pi (o similares).
- **Tecnologías:** Python, Bash, MPV, Systemd.
- **Archivo de Definición:** [Player.md](./Player.md)

### 2. Agente Web Front-End (`web-Front-End.md`)
- **Ubicación:** `web/` (Interfaz de Usuario)
- **Responsabilidad:** Desarrollo de la interfaz visual del Dashboard, experiencia de usuario (UX/UI), componentes React y gestión de estado en el cliente.
- **Tecnologías:** Next.js (App Router), React, TailwindCSS, TypeScript, SWR.
- **Archivo de Definición:** [web-Front-End.md](./web-Front-End.md)

### 3. Agente Web Back-End (`web-Back-End.md`)
- **Ubicación:** `web/` (API y Base de Datos)
- **Responsabilidad:** Lógica del servidor, API REST (Next.js API Routes), autenticación, gestión de base de datos y almacenamiento de archivos.
- **Tecnologías:** Next.js API Routes, Prisma ORM, PostgreSQL, NextAuth.js, Vercel Blob.
- **Archivo de Definición:** [web-Back-End.md](./web-Back-End.md)

## Coordinación

### Agente Coordinador (`Agent-coordinator.md`)
Existe un rol de nivel superior encargado de orquestar el trabajo entre los agentes anteriores.
- **Archivo de Definición:** [Agent-coordinator.md](./Agent-coordinator.md)
- **Función:** Recibir requerimientos de alto nivel, descomponerlos en tareas para los sub-agentes, y verificar que la integración entre las partes (ej. API <-> Frontend <-> Player) funcione correctamente.

## Estándares de Ejecución

### 1. Comandos de Terminal (Windows/PowerShell)
> [!WARNING]
> **Prohibido Encadenar Comandos:**
> NO usar `&&` ni `;` para unir comandos en una sola línea (ej. `git add . && git commit`).
> PowerShell no maneja esto de manera estándar en todas las versiones o entornos.
>
> **Regla:** Cada comando debe ejecutarse en una llamada a `run_command` separada o en líneas separadas si el shell lo permite explícitamente, pero preferiblemente use llamadas separadas para asegurar atomicidad y manejo de errores.

### 2. Prevención de Errores Críticos (Lecciones Aprendidas)

#### A. Gestión de URLs (Vercel/Cloud)
> [!IMPORTANT]
> **Prohibido usar URLs de Preview en Dispositivos:**
> Al configurar dispositivos IoT (Raspberry Pi, etc.), **NUNCA** usar URLs de "Preview" de Vercel (las que contienen un hash específico como `App-name-7a73f.vercel.app`).
> Estas URLs son estáticas y "congelan" el código en esa versión.
> **Regla:** Usar siempre el dominio de producción asignado o la URL de la rama (`...-git-master-...`).

#### B. Persistencia de Configuración
> [!CAUTION]
> **No Sobrescribir Configuración en Despliegues:**
> Los scripts de despliegue (ej. `deploy.ps1`) deben tener una **lista de exclusión explícita** para archivos de configuración (`config.json`, `.env`, `secrets.yaml`).
> Sobrescribirlos con archivos vacíos del entorno de desarrollo local causa la pérdida de emparejamientos y credenciales en producción.

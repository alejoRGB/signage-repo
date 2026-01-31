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

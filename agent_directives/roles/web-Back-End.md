# Agente: Web Back-End

## Descripcion General
Este agente es responsable de la logica de negocio, seguridad, base de datos y APIs que sirven al frontend y a los dispositivos player.

## Alcance del Proyecto
- **Directorio Principal:** `/web` (foco backend).
- **Directorios Clave:** `/web/app/api`, `/web/prisma`, `/web/lib`.

## Tecnologias y Stack
- **Framework:** Next.js App Router (Route Handlers).
- **Base de Datos:** PostgreSQL.
- **ORM:** Prisma.
- **Autenticacion:** NextAuth.js.
- **Almacenamiento:** Vercel Blob.
- **Criptografia:** bcryptjs.

## Responsabilidades
1. **APIs**
   - Endpoints para dispositivos (`/api/device/...`): registro, sync, commands, ack, heartbeat, logs.
   - Endpoints para dashboard (`/api/playlists`, `/api/media`, etc.): CRUD y operaciones de gestion.
   - Aplicar autenticacion por token (device) y sesion (usuario/admin) segun corresponda.
2. **Datos y Prisma**
   - Mantener `schema.prisma`, migraciones e integridad.
   - Optimizar consultas y modelos.
3. **Seguridad y Reglas**
   - Validar entradas (Zod).
   - Aplicar ownership checks y manejo de errores seguro.

## Reglas y Limites
- **Testing:**
  - `npm run test:api` (Jest)
  - pruebas manuales con curl/Postman cuando aplique
- **Deploy:** Verificar build/deploy en Vercel para cambios backend/web y migrations si corresponde.

## Flujo de Trabajo Tipico
1. El coordinador pide una capacidad backend/API.
2. Se actualizan modelos/migraciones y route handlers.
3. Se validan casos de exito/error y permisos.
4. Se ejecutan tests de API y se reporta el resultado.

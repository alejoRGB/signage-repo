# Plan de Auditoría Continua – Expanded Signage

Fecha de inicio: 2026-02-11  
Estado: En curso  

Este documento sirve como **log vivo** de la auditoría del proyecto.  
La idea es que **cualquier agente** pueda retomarla desde aquí sin depender del contexto de conversación.

---

## 1. Preparación y marco de referencia

### 1.1 Documentación canónica de referencia

**Objetivo:** Definir claramente qué documentos se consideran la “verdad esperada” del sistema para compararlos contra el código y el comportamiento real.

**Archivos canónicos identificados:**

- **Contexto de producto y arquitectura**
  - `PRD.md`
  - `skills/project/PROJECT.md`
  - `skills/project/ARCHITECTURE.md`
  - `skills/project/MPV.md`
  - `skills/project/DEPLOYMENT.md`

- **Directivas de agentes y flujos operativos**
  - `directives/AGENTS.md`
  - `directives/auto_qa.md`
  - `directives/workflow_git.md`

- **Documentación funcional / UX**
  - `docs/features_y_flujos.md`
  - `docs/feature_emparejamiento.md`

- **Skills relevantes para auditoría**
  - `.agents/skills/vercel-react-best-practices/AGENTS.md`
  - `.agents/skills/security-review/SKILL.md`
  - `.agent/skills/canonical-context-manager/SKILL.md`
  - `.agent/skills/mpv-playback/SKILL.md`
  - `.agent/skills/rpi-deploy-debug/SKILL.md`
  - `.agents/skills/frontend-design/SKILL.md`

**Notas / decisiones:**

- Para **product/feature-level** se tomará `PRD.md` como fuente principal, y `skills/project/*` como refinamiento técnico.
- Para **arquitectura** gana siempre `skills/project/ARCHITECTURE.md` frente a otros documentos si hay conflicto.
- Para **player y MPV** se utilizarán `skills/project/MPV.md` + skill `mpv-playback` como referencia normativa.
- Para **deploy** se prioriza `skills/project/DEPLOYMENT.md` y `directives/workflow_git.md`.
- Existe **canon duplicado** entre `.agent/skills/project/*` y `skills/project/*` (ya detectado en `AUDIT_COMPLETA.md`); la auditoría futura deberá decidir una única fuente y actualizar referencias.  
  - **Estado actual:** pendiente de unificación; de momento se usará **`skills/project/*`** como canon preferido, ya que es lo que utiliza el `canonical-context-manager`.

### 1.2 Inventario de código y herramientas de ejecución

**Estructura principal del repo (resumen):**

- `web/` – Dashboard, API, tests frontend y configuración Next.js/Prisma.
- `player/` – Cliente Raspberry Pi (Python) + scripts de setup.
- `execution/` – Scripts orquestadores:
  - `web_ops.py` – Dev/build/lint/test/db para `web/`.
  - `player_ops.py` – Operaciones sobre el player (local/remoto).
  - `run_tests.py` – Entry point unificado para suites de tests.
  - `verify_setup.py`, `security_verify.py`, `utils.py` – Utilidades varias.
- `qa_automation/` – Suite Playwright/TypeScript adicional.
- `directives/` – SOPs de alto nivel (DOE).
- `skills/` y `.agent/.agents/skills/` – Contexto canónico y skills para agentes.

**Herramientas de ejecución relevantes para la auditoría:**

- **Web (Next.js)**
  - `python execution/web_ops.py dev`
  - `python execution/web_ops.py build`
  - `python execution/web_ops.py lint`
  - `python execution/web_ops.py test`
  - `python execution/web_ops.py db:migrate | db:studio | db:seed`

- **Player (Raspberry Pi)**
  - `powershell .\deploy.ps1 -PlayerIp <IP> -PlayerUser <USER>`
  - `python execution/player_ops.py start`
  - `python execution/player_ops.py remote_start|remote_stop|remote_restart|remote_status`

- **QA / Tests**
  - `python execution/run_tests.py all`
  - `python execution/run_tests.py unit`
  - `python execution/run_tests.py e2e`
  - `python execution/run_tests.py qa`

**Estado de verificación de herramientas (2026-02-11):**

- En esta fase **NO se han ejecutado todavía** los comandos anteriores; solo se han identificado como entry points canónicos.
- Cuando un agente ejecute alguno de estos comandos, debe **anotar aquí**:
  - Fecha y hora.
  - Comando exacto ejecutado.
  - Resultado (OK / fallo + resumen del error).

Ejemplo de anotación futura:

- `[PENDIENTE]` `python execution/web_ops.py test` – no ejecutado aún en esta auditoría.
- `[PENDIENTE]` `python execution/run_tests.py all` – no ejecutado aún en esta auditoría.

---

## 2. Fase 2 – Web: Arquitectura, roles y autenticación

> **Estado:** En curso (revisión estática completada, sin pruebas automáticas aún).  
> **Responsable actual:** Agente DOE (GPT-5.1 en Cursor)

### 2.1 Modelos de datos (PRD vs `schema.prisma`)

**Conclusión general:** Los modelos principales (`User`, `Device`, `MediaItem`, `Playlist`, `PlaylistItem`, `Schedule`, `ScheduleItem`, `DeviceLog`, `Admin`) **coinciden en lo esencial** con lo descrito en `PRD.md`.  

- `User`  
  - Campos clave PRD (`email`, `password`, `name`, `username`, `role`, `isActive`, timestamps) están presentes.  
  - `role` es un `enum Role { USER, ADMIN }` con `USER` por defecto (alineado con PRD: usuarios normales más admins separados).

- `Admin`  
  - Modelo separado (`Admin`) con `email`, `password`, `name`, timestamps; coincide con PRD, que define admins como entidad aparte.

- `Device`  
  - Campos de PRD (`name`, `token`, `status`, `lastSeenAt`, `userId`, `activePlaylistId`, `playingPlaylistId`, `defaultPlaylistId`, `scheduleId`, `pairingCode`, `pairingCodeExpiresAt`) están presentes.  
  - Relación con `User`, `Playlist`, `Schedule` y `DeviceLog` está modelada correctamente.

- `MediaItem`  
  - Campos de PRD (`name`, `type`, `url`, `filename`, `duration`, `width`, `height`, `fps`, `size`, `cacheForOffline`, `userId`, timestamps) están presentes.  
  - `type` es `String` en prisma, pero el código de validación restringe a `"image" | "video" | "web"` (al día de hoy consistente con PRD).

- `Playlist` / `PlaylistItem`  
  - `Playlist` tiene `type` (`media`/`web`) y `orientation` (`landscape`/portrait*), alineado con PRD.  
  - `PlaylistItem` referencia `MediaItem` y `Playlist` con `order` y `duration` (editable), como en PRD.

- `Schedule` / `ScheduleItem`  
  - Estructura (`dayOfWeek`, `startTime`, `endTime`, `playlistId`) coincide con PRD, incluyendo relación 1:N y `onDelete: Cascade` en `ScheduleItem`.

**Mismatches relevantes:** Ninguno crítico detectado en el modelo respecto al PRD; las diferencias son de **tipo técnico menor** (por ejemplo `type` como `String` en lugar de un enum fuerte) pero se encapsulan vía Zod.

### 2.2 Autenticación y roles (NextAuth + middleware)

**Implementación observada:**

- NextAuth configurado en `web/lib/auth.ts` y expuesto en `/api/auth/[...nextauth]`:
  - Provider de credenciales único con campo `loginType` que diferencia explícitamente entre login de `admin` y `user`.
  - **Admin login**: busca en `prisma.admin` por email; si la contraseña es válida, devuelve usuario con `role: "ADMIN"` y `isActive: true`.
  - **User login**: busca en `prisma.user` por `username` o `email`; exige `isActive = true` y compara contraseña hash.
  - El token JWT incluye `id`, `role` y `isActive`; las sesiones usan estrategia `"jwt"`.
  - Para admins se aplica expiración estricta de 1 hora vía `loginTimestamp` y lógica en callback `jwt` (coincide con la intención de admins “más sensibles” del PRD, aunque el PRD no menciona el límite temporal explícitamente).

- Middleware `web/middleware.ts` con `withAuth`:
  - Protege rutas `/admin/*` y `/dashboard/*`:
    - Sin token:
      - `/admin/*` → redirige a `/admin/login`.
      - `/dashboard/*` → redirige a `/login`.
    - Con token:
      - Si `role !== "ADMIN"` y accede a `/admin/*` → redirige a `/dashboard`.
      - Si `role === "ADMIN"` y accede a `/dashboard/*` → redirige a `/admin`.
    - Manejo especial de login pages para evitar bucles.
  - Callback `authorized` siempre devuelve `true` y se delega todo el control a la función de middleware (patrón intencional para custom redirects).

**Comparación con PRD:**

- El PRD indica:
  - Usuarios (`USER`) no pueden acceder a panel/admin ni crear otros usuarios → **cumplido** por el middleware y las APIs.
  - Admins gestionan usuarios pero **no acceden al contenido (devices/media/playlists) de otros usuarios** → el middleware sí separa vistas `/admin` vs `/dashboard`, y las APIs de contenido filtran por `userId = session.user.id`, por lo que en la práctica un admin autenticado no ve contenido de otros usuarios vía panel estándar. Esto está **alineado con la intención**, aunque el modelo `User.role = ADMIN` existe y podría permitir futuras extensiones.

**Notas para otro agente:**

- La separación “Admin como entidad aparte” está bien implementada: tabla `Admin`, login separado, middleware por prefijo de ruta, APIs admin protegidas por `session.user.role === "ADMIN"`.
- No se detectaron rutas públicas que devuelvan datos de usuario sin auth.

### 2.3 Autorización en APIs de usuario (Devices, Media, Playlists, Schedules)

Muestreo de endpoints clave:

- **Devices** (`/api/devices`, `/api/devices/[id]`)
  - GET: filtra por `userId = session.user.id`.  
  - POST: asigna `userId = session.user.id`.  
  - PUT/DELETE: verifican ownership y validan que playlists y schedules referidos también pertenezcan al usuario antes de actualizar; DELETE usa `deleteMany` con filtro por `userId` (evita borrar de otro usuario).

- **Media** (`/api/media`)
  - GET: filtra por `userId = session.user.id`.  
  - DELETE: `findFirst` + `userId = session.user.id`, y solo entonces borra y limpia blobs; no hay camino para borrar media ajena.  
  - POST: valida con `CreateMediaItemSchema` y crea con `userId = session.user.id`. Maneja correctamente `type: "web"` (pone `filename: null`).

- **Playlists** (`/api/playlists`, `/api/playlists/[id]`)
  - GET: filtra por `userId = session.user.id`.  
  - GET by id: `where: { id, userId: session.user.id }`.  
  - PUT: primero verifica ownership; luego valida que los `mediaItemId` sean compatibles con el tipo de playlist (`media` vs `web`); reemplaza items vía transacción.  
  - DELETE: `deleteMany` con `userId = session.user.id`.

- **Schedules** (`/api/schedules`, `/api/schedules/[scheduleId]`)
  - GET/POST: filtran/crean con `userId = session.user.id`.  
  - GET/DELETE/PATCH by id: siempre filtran por `userId = session.user.id`.  
  - PATCH: valida que todas las `playlistId` referidas pertenezcan al usuario (conteo por `userId`), y comprueba solapamientos por día antes de guardar (coincide con PRD: “no overlapping rules”).  

**Conclusión:** La lógica de autorización a nivel de recursos **es consistente con el PRD**: todos los recursos de usuario se filtran por `userId = session.user.id` y los endpoints admin usan `session.user.role === "ADMIN"`. No se han detectado APIs que permitan escapar este modelo sin pasar por estas verificaciones.

### 2.4 Pendientes para cerrar la fase 2

- [HECHO – 2026-02-11] Ejecutados tests web vía `python execution/web_ops.py test` (API + UI).  
  - `npm run test:api` (Jest) → **2 suites OK**: `__tests__/api/health.test.ts`, `__tests__/api/delete-media.test.ts`.  
  - `npm run test:ui` (Vitest) → **3 suites OK**: `Hello`, `DeviceListTable`, `PlaylistEditor`.  
  - No se detectaron fallos relacionados con auth/roles en estas suites (aunque no cubren aún todos los flujos PRD de login/admin).
- [PENDIENTE] Añadir al menos 1–2 tests específicos que cubran:
  - Login de USER vs ADMIN, y redirecciones `/admin/*` vs `/dashboard/*` según `middleware.ts`.
  - Acceso prohibido a rutas admin con role USER y viceversa.
- [PENDIENTE] Documentar explícitamente en `PRD.md` o `skills/project/PROJECT.md` que las sesiones de admin expiran a la hora (comportamiento ya implementado en código pero no reflejado en PRD).

Se recomienda que el próximo agente:

- Extienda la batería de tests para cubrir los flujos anteriores (apoyándose en NextAuth + middleware).
- Actualice también `AUDIT_COMPLETA.md` con un breve resumen de que **la sección de arquitectura web, roles y autenticación está alineada** entre PRD y código, con la nota específica sobre la expiración de admins como único matiz no documentado.

---

## Notas para futuros agentes

- Este documento debe mantenerse **breve pero preciso**: solo decisiones, estado de fases y comandos efectivamente ejecutados.
- Para detalles extensos de findings, usar `AUDIT_COMPLETA.md` (auditoría estática) y/o crear secciones específicas allí.
- Antes de modificar el canon (`skills/project/*`), usar el flujo del skill `canonical-context-manager` una vez que haya consenso sobre los cambios.

---

## 3. Fase 3 – Web: Flujos funcionales (Devices, Media, Playlists, Schedules)

> **Estado:** Revisión estática completada contra PRD; sin E2E específicos nuevos en esta fase.  
> **Responsable actual:** Agente DOE (GPT-5.1 en Cursor)

### 3.1 Device Management

**PRD (sección 3. Device Management, 10.1 Setup Flow, 13.2/13.6 Tests):**
- Ver dispositivos del usuario, con nombre, estado online/offline, lastSeen, playlists/schedule asignados.
- Editar: cambiar nombre, asignar default playlist y schedule.
- Borrar dispositivo con confirmación y restricción por ownership.
- Ver logs por dispositivo (`DeviceLog`).

**Código revisado:**
- UI: `web/app/dashboard/devices/page.tsx`, `device-manager.tsx`, `components/devices/*` (lista, acciones, logs, edición).
- API: `web/app/api/devices/route.ts`, `web/app/api/devices/[id]/route.ts`, `web/app/api/devices/[id]/logs/route.ts`.

**Match vs PRD:**
- Listado de devices filtrado por `userId = session.user.id`, con cálculo de `connectivityStatus` en función de `lastSeenAt` (PRD indica 5 minutos, código usa 2 minutos como umbral visual; comportamiento funcional equivalente, pero sería bueno alinear docs/constante).
- Edición de nombre, `activePlaylistId`, `defaultPlaylistId` y `scheduleId` con verificación de ownership para playlists y schedules antes de guardar (en línea con “strict ownership” del canon).
- Borrado de dispositivos restringido a `userId = session.user.id` y uso de `deleteMany` para evitar borrar de otros usuarios.
- Logs: existe modal de logs por dispositivo y endpoint `/api/devices/[id]/logs`, alineado con la sección de logs del PRD.

**Conclusión:** Flujos principales de Device Management coinciden con lo descrito en el PRD; único matiz menor es el umbral exacto para considerar un dispositivo “online” (2 vs 5 minutos).

### 3.2 Media Library

**PRD (sección 4. Media Library):**
- Tipos `image`, `video`, `web`, con metadatos (resolución, duración, fps, tamaño).
- Upload de imágenes y videos a Blob + creación de registro en `/api/media`.
- “Add Website” con nombre, URL, duración por defecto, orientación y flag `cacheForOffline`.
- Borrado de media (idealmente con protección cuando está en playlists; PRD lo marca como “TBD”).  

**Código revisado:**
- UI: `web/app/dashboard/media/page.tsx`, `media-manager.tsx`, `components/media/add-website-modal.tsx`.
- API: `web/app/api/media/route.ts`, `web/app/api/media/upload/route.ts` (no se releyó completo aquí, pero se sabe por la auditoría previa que gestiona Blob).
- Validaciones: `web/lib/validations.ts` (`CreateMediaItemSchema`).

**Match vs PRD:**
- `/api/media` GET/POST/DELETE funcionan con `userId = session.user.id` y validan payload con Zod según tipos (`image | video | web`), coherente con PRD.
- `AddWebsiteModal` recoge `name`, `url` y `cacheForOffline` y llama a `onAdd` con `type: "web"`, `duration` y `cacheForOffline`. La orientación de la web se maneja a nivel de playlist (no por media item), lo cual es razonable aunque el PRD mencione orientación en el media: el comportamiento efectivo es equivalente (rotación se aplica por playlist).
- DELETE elimina la media, borra items asociados en playlists y, si es Blob, intenta borrar del storage (encaja con la intención del PRD, que decía que la restricción de “no borrar si está en playlists” era TBD; aquí se optó por cascade).

**Detalle menor:** `AddWebsiteModal` tiene un checkbox duplicado para `cacheForOffline`, y el `duration` hardcodeado a 10s podría documentarse mejor en el PRD como “default configurable solo en playlist”. No afecta la coherencia funcional general.

### 3.3 Playlists

**PRD (sección 5. Playlists):**
- Tipos de playlist: `media` (solo imágenes/video) y `web` (solo web items); Mixed playlists **no soportadas**.
- Editor que permite añadir items desde la media library, reordenar, borrar y configurar duración (editable para imágenes/web, fija para videos).
- Asignación como default/active en Device y uso en Schedules.

**Código revisado:**
- UI lista: `web/app/dashboard/playlists/page.tsx` + `playlist-list.tsx`.
- Editor: `web/app/dashboard/playlists/[id]/page.tsx` + `playlist-editor.tsx` (y tests existentes en `__tests__/components/PlaylistEditor.test.tsx`).  
- API: `web/app/api/playlists/route.ts`, `web/app/api/playlists/[id]/route.ts`.

**Match vs PRD:**
- Playlists se tipan con `type: "media" | "web"` y `orientation`, y el editor filtra el tipo de media permitido por playlist, reforzado en backend: `/api/playlists/[id]` comprueba que no se añadan items `web` a playlists `media` ni viceversa (refuerzo de la política “no mixed playlists”).  
- El editor calcula duración de item como `item.duration || mediaItem.duration || 10`, respetando duración de video cuando está definida y permitiendo overrides; esto coincide con la intención del PRD (videos con duración fija, imágenes/web controladas por duración de item) aunque en detalle podría valer la pena añadir tests que verifiquen este contrato exacto.
- CRUD de playlists y ownership (filtrar por `userId = session.user.id`) está correctamente implementado.

**Conclusión:** El comportamiento de playlists (tipos, contenido permitido, editor, relación con media) está alineado con el PRD y las restricciones de negocio.

### 3.4 Schedules

**PRD (sección 6. Schedules):**
- Schedule semanal con items `{ dayOfWeek, startTime, endTime, playlistId }`, sin solapamientos, con copia de días y gaps que caen en default playlist.
- Editor UI con 7 columnas (días), validación de overlaps, copy-day, y persistencia via `/api/schedules/:scheduleId` PATCH.

**Código revisado:**
- UI lista: `web/app/dashboard/schedules/page.tsx` + `components/schedules/schedule-list.tsx`.
- Editor: `web/app/dashboard/schedules/[scheduleId]/page.tsx` + `components/schedules/schedule-editor.tsx`.
- API: `web/app/api/schedules/route.ts`, `web/app/api/schedules/[scheduleId]/route.ts`.

**Match vs PRD:**
- `ScheduleEditor` implementa estructura de 7 columnas con botones “Add Item” y lógica de **no solapamiento** tanto en el cliente (`hasOverlap`) como en el servidor (`PATCH /api/schedules/:scheduleId` revalida overlaps por día antes de guardar).  
- El copy-day está presente (`CopyScheduleModal`) y copia reglas de un día a otro reemplazando las existentes, alineado con la descripción del PRD.
- Ownership: todos los accesos a schedules y a playlists referidos en items filtran por `userId = session.user.id`, cumpliendo la política de aislamiento.

**Puntos que quedan delegados a otras fases (Player):**
- La resolución en tiempo real de qué playlist se ejecuta en cada momento (cada 10s) se define en el player y se auditará en la fase de Player; desde la perspectiva de Web, la estructura y los invariantes (no solapamientos, copy-day, asignación de playlists) están bien cubiertos y coinciden con el PRD.

---

**Sugerencia para próximos agentes:**  
Si se añaden nuevas features en estos módulos, conviene extender los tests existentes (`__tests__/components/DeviceListTable.test.tsx`, `PlaylistEditor.test.tsx`, tests de schedules) para mantener cubiertos los contratos PRD (tipos de playlist, no solapamientos de schedule, ownership, etc.).


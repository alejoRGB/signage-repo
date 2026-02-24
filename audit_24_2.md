# Audit Técnico Integral (24/02/2026)

## Alcance y metodología

Audit realizado sobre el repositorio `d:\Expanded Signage\proyecto_1` con foco en:

- Seguridad (auth/authz, exposición de datos, hardening, surface area)
- Lógica de negocio y coherencia entre módulos (`web`, `player`, deploy/automation)
- Preparación para producción (build, tests, lint, operación, mantenibilidad)

Metodología usada (sin especulación):

- Revisión manual de rutas API críticas, librerías core y scripts de despliegue/player
- Scans globales (`rg`) sobre patrones de riesgo, debug, secretos, logs, y anti-patterns
- Ejecución de checks reales (`lint`, tests, `next build`, `npm audit`)
- Verificación de qué archivos están versionados vs. ignorados (`git ls-files`, `git check-ignore`)

## Resumen ejecutivo

Estado actual:

- `web` **no está listo para producción** sin cambios.
- `player` está funcional (tests pasan), pero tiene riesgos de seguridad/operación relevantes.
- Hay varios problemas de seguridad y coherencia que deben resolverse antes de un entorno real.

Bloqueadores principales:

1. **Riesgo de path traversal / LFI** en flujo de media (`web` + `player`)
2. **Lógica de expiración admin incompleta** (JWT/session vs middleware)
3. **Bypass de autorización** en actualización de playlists (media no perteneciente al usuario)
4. **ACK de comandos permite estado `PENDING`** (replay / requeue accidental)
5. **Rate limiting en memoria** (ineficaz en multi-instancia/serverless)
6. **Hardening insuficiente** (CSP muy permisivo, endpoints debug en runtime)
7. **Lint con 74 problemas** (56 errores), incluyendo issues en rutas y componentes
8. **Dependencia vulnerable**: `next@16.1.4` con advisory de alta (fix disponible)

## Checks ejecutados (resultado real)

- `python -m pytest` en `player/`: **PASS** (`37/37`)
- `npm run test:api` en `web/`: **PASS** (`15 suites`, `67 tests`)
- `npm run test:ui` en `web/`: **PASS** (`7 files`, `30 tests`) con warning de `act(...)`
- `npm run lint` en `web/`: **FAIL** (`74 problems`, `56 errors`, `18 warnings`)
- `npm run build` en `web/`:
  - Primer intento: **FAIL** por tipos Prisma desactualizados
  - Luego de `npx prisma generate`: **PASS**
- `npm audit --omit=dev`:
  - `web/`: **1 vulnerabilidad alta** (`next`, fix recomendado `16.1.6`)
  - `qa_automation/`: **0 vulnerabilidades**

## Hallazgos críticos (resolver antes de producción)

### 1) Path traversal / lectura de archivos en flujo de media (web) + escritura fuera de `media_dir` (player)

Evidencia:

- `web/lib/validations.ts:85` acepta `url` genérica (`z.string().url(...)`) sin restringir esquema/host
- `web/lib/validations.ts:87` acepta `filename` arbitrario sin sanitización de path (solo `xss`)
- `web/app/api/media/download/[id]/route.ts:59` considera “externo” solo si `url.startsWith("http")`
- `web/app/api/media/download/[id]/route.ts:72` arma `filePath = path.join(uploadsDir, mediaItem.filename)` sin normalizar/contener
- `web/app/api/media/download/[id]/route.ts:83` lee ese path con `fs.readFileSync(...)`
- `player/sync.py:484` escribe `os.path.join(self.media_dir, filename)` sin `basename`
- `web/public/sync.py:158` repite el mismo patrón en una copia expuesta públicamente

Impacto:

- Un usuario autenticado (con control de `MediaItem`) puede intentar forzar rutas relativas (`../`) y acceder a archivos locales del servidor en `/api/media/download/[id]` si el `url` no empieza con `http`.
- Un payload de playlist malicioso puede intentar escribir fuera de `media_dir` en el player.

Cambios necesarios:

- Validar `filename` con whitelist estricta (`basename`, sin `/`, `\\`, `..`, control chars`).
- En `media/download`, resolver path con `path.resolve` y rechazar si no queda dentro de `uploadsDir`.
- Restringir `url` por tipo:
  - `web`: `https://` (lista de hosts permitidos si aplica)
  - `image/video`: blob storage interno o URLs firmadas aprobadas
- En `player/sync.py`, usar `basename` antes de guardar cualquier archivo (`download_media`).

### 2) Expiración de sesión admin inconsistente (middleware sigue autorizando tokens expirados)

Evidencia:

- `web/lib/auth.ts:107` session callback detecta `token.error === "AdminSessionExpired"`
- `web/lib/auth.ts:134` jwt callback marca token expirado con `error`
- `web/middleware.ts:32`, `web/middleware.ts:36`, `web/middleware.ts:43`, `web/middleware.ts:49` decide solo por `token.role`
- `web/middleware.ts:58` `authorized` devuelve siempre `true`

Impacto:

- El middleware no contempla `token.error`, por lo que puede permitir navegación `/admin` con token JWT marcado como expirado.
- Resultado probable: UX inconsistente y potencial bypass parcial de política de sesión (depende de cada API/page).

Cambios necesarios:

- En `middleware`, rechazar/redirigir si `token?.error === "AdminSessionExpired"`.
- Implementar expiración con un mecanismo consistente (JWT `maxAge`, `session.maxAge`, validación centralizada).
- Evitar retornar `{}` como sesión inválida (`web/lib/auth.ts:109`); devolver `null`/signout controlado.

### 3) Bypass de autorización en actualización de playlist (media items no verificados por ownership)

Evidencia:

- `web/app/api/playlists/[id]/route.ts:72` toma `mediaItemIds` del request
- `web/app/api/playlists/[id]/route.ts:73`
- `web/app/api/playlists/[id]/route.ts:74` consulta `mediaItem.findMany` solo por `id`, sin `userId`
- `web/app/api/playlists/[id]/route.ts:94` luego persiste items nuevos

Impacto:

- Un usuario podría referenciar `mediaItemId` de otro usuario si conoce/obtiene IDs, y el endpoint no lo bloquea.

Cambios necesarios:

- Filtrar `mediaItem.findMany` por `userId: session.user.id`.
- Verificar que `mediaItems.length === mediaItemIdsUnicos.length`; si no, rechazar.
- Agregar Zod schema para `PUT /api/playlists/[id]` (hoy parsea JSON libre).

### 4) ACK de comandos permite `PENDING` (reintroduce comandos y rompe semántica de ACK)

Evidencia:

- `web/lib/validations.ts:120` incluye `PENDING` en `SyncDeviceCommandStatusValues`
- `web/lib/validations.ts:199` `DeviceCommandAckSchema`
- `web/lib/validations.ts:202` `status` del ACK acepta ese enum
- `web/app/api/device/ack/route.ts:59` persiste `status` enviado por el device
- `web/app/api/device/ack/route.ts:61` si `status === "PENDING"` resetea `ackedAt` a `null`

Impacto:

- El endpoint de ACK permite “des-ackear” comandos.
- Puede generar reentrega/replay accidental, loops o estados inconsistentes bajo fallas de red/cliente.

Cambios necesarios:

- Crear schema específico de ACK que solo permita `ACKED | FAILED`.
- Tratar `PENDING` como payload inválido (`400`).
- Opcional: hacer transición de estado idempotente y monotónica (no volver a `PENDING`).

## Hallazgos altos

### 5) Rate limiting en memoria no sirve para producción distribuida (serverless / multi-instancia)

Evidencia:

- `web/lib/rate-limit.ts:1` usa `RateLimiterMemory`
- `web/lib/rate-limit.ts:28` cache local de limiters en `Map`
- `web/lib/rate-limit.ts:37` crea limiters en memoria por proceso

Impacto:

- Se resetea en reinicios/cold starts.
- No comparte estado entre instancias.
- Un atacante puede saltar límites repartiendo requests.

Cambios necesarios:

- Migrar a rate limit distribuido (Redis/Upstash/Vercel KV o DB-backed).
- Estandarizar keys por actor real (IP parseada correctamente, deviceId, userId).

Estado (24/02): RESUELTO (backend distribuido + keys estandarizadas)

- `web/lib/rate-limit.ts` ahora usa Upstash (`@upstash/ratelimit` + `@upstash/redis`) cuando existen `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.
- Mantiene fallback a memoria para desarrollo/local y override `RATE_LIMIT_BACKEND=memory`.
- `web/lib/rate-limit-key.ts` centraliza parseo de IP (`x-forwarded-for` / `x-real-ip` / `forwarded`) y normalizaciÃ³n de claves.
- Endpoints (`contact`, `device/register`, `device/*`) usan keys consistentes por actor:
  - `ip:<client-ip>` para flujos por IP
  - `device-token:<sha256-trunc>` para flujos de device (evita guardar tokens crudos en Redis)
- `web/.env.example` documenta configuraciÃ³n de rate limiting distribuido.
- Tests agregados: `web/__tests__/lib/rate-limit.test.ts`, `web/__tests__/lib/rate-limit-key.test.ts`.
- Pendiente solo operativo: configurar Upstash en Vercel/producciÃ³n.

### 6) CSP demasiado permisivo (XSS hardening insuficiente)

Evidencia:

- `web/next.config.ts:13` `script-src` incluye `'unsafe-eval'` y `'unsafe-inline'`
- `web/next.config.ts:14` `style-src` incluye `'unsafe-inline'`
- `web/next.config.ts:17` `connect-src 'self' https: ...` (demasiado amplio)

Impacto:

- Reduce significativamente la protección frente a XSS y script injection.

Cambios necesarios:

- Endurecer CSP por entorno (dev vs prod).
- Eliminar `'unsafe-eval'` y minimizar `'unsafe-inline'` en producción.
- Restringir `connect-src`, `img-src`, `frame-src` a dominios concretos.
- Agregar `object-src 'none'`, `base-uri 'self'`, `frame-ancestors` (si aplica).

Estado (24/02): RESUELTO parcialmente (hardening aplicado, queda migración a nonce)

- `web/next.config.ts` ahora genera CSP por entorno:
  - `dev/preview`: mantiene `unsafe-eval` y `vercel.live` para tooling.
  - `prod`: elimina `unsafe-eval`.
- `script-src` y `connect-src` se restringieron a dominios concretos (GTM/GA + `vercel.live` solo cuando aplica), eliminando `connect-src https:` amplio.
- Se agregaron directivas de hardening faltantes: `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `script-src-attr 'none'`, `worker-src`, `frame-ancestors`, `upgrade-insecure-requests` (prod).
- Riesgo residual documentado: `script-src 'unsafe-inline'` y `style-src 'unsafe-inline'` se mantienen por compatibilidad con Next.js App Router + scripts inline de JSON-LD/GA. Para cerrar completamente el hallazgo, migrar a CSP con nonce/hash.

### 7) Endpoints debug expuestos en runtime

Evidencia:

- `web/app/api/debug-env/route.ts:13` muestra presencia/prefijo de URLs de DB
- `web/app/api/debug-env/route.ts:24` devuelve mensajes de error de conexión DB
- `web/app/api/debug/playlist/[id]/route.ts:12` solo bloquea si `NODE_ENV === 'production'`

Impacto:

- En entornos no-prod expuestos (staging/dev públicos) filtra información sensible/interna.
- Aumenta superficie de ataque y fingerprinting.

Cambios necesarios:

- Eliminar estas rutas del bundle de producción o proteger con auth+allowlist+flag secreto.
- No devolver prefijos de secretos ni errores de DB al cliente.

Estado (24/02): RESUELTO

- `web/lib/debug-endpoint-access.ts` centraliza la política de acceso:
  - `404` por defecto (endpoints ocultos si `ENABLE_DEBUG_API_ROUTES` no está habilitado)
  - requiere sesión autenticada `ADMIN`
  - bloquea cuentas inactivas
- `web/app/api/debug-env/route.ts` y `web/app/api/debug/playlist/[id]/route.ts` usan la misma política (el check por `NODE_ENV` ya no es la única protección).
- `web/app/api/debug-env/route.ts` ya no devuelve prefijos de `DATABASE_URL*` ni mensajes de error de DB al cliente (solo flags booleanos + estado genérico).
- `web/.env.example` documenta `ENABLE_DEBUG_API_ROUTES` como flag temporal y solo para entornos privados/locales.
- Test agregado: `web/__tests__/api/debug-endpoints.test.ts`.

### 8) `device/sync` mezcla código de debug con código de producción (logs excesivos + `eslint-disable`)

Evidencia:

- `web/app/api/device/sync/route.ts:1` `/* eslint-disable */`
- `web/app/api/device/sync/route.ts:9` comentario “Force redeploy for sync fix”
- `web/app/api/device/sync/route.ts:100` `any` en `updateData`
- `web/app/api/device/sync/route.ts:121`, `:122`, `:132`, `:133`, `:134`, `:135` `console.log(...)`
- `web/app/api/device/sync/route.ts:182` `_debug_version`
- `web/app/api/device/sync/route.ts:143` emite URLs con token en query para media download

Impacto:

- Spam de logs por poll de dispositivos.
- Riesgo de filtrar metadata interna y degradar observabilidad/costo.
- Deuda técnica en endpoint crítico.

Cambios necesarios:

- Eliminar logs de debug y `_debug_version`.
- Restaurar ESLint y tipar el endpoint.
- Si se requiere tracing, usar logger estructurado con niveles y redacción.

Estado (24/02): RESUELTO

- `web/app/api/device/sync/route.ts` fue refactorizado:
  - se eliminó `/* eslint-disable */`
  - se eliminó comentario de debug/operativo ("Force redeploy...")
  - se eliminaron `console.log(...)` de formateo de playlists/items (spam por poll)
  - se eliminó `_debug_version` del response
  - se reemplazaron `any` por tipos explícitos/estructurales y `Prisma.DeviceUncheckedUpdateInput`
- Test actualizado en `web/__tests__/api/device-heartbeat-sync.test.ts` para asegurar que `_debug_version` no se expone.
- Nota: la URL de media con `?token=` sigue presente a propósito en este patch porque corresponde al hallazgo `#9` (token en query params).

### 9) Token de device en query params (status/media download) expuesto a logs/caches

Evidencia:

- `web/app/api/device/status/route.ts:7` toma `token` por query
- `web/app/api/media/download/[id]/route.ts:15` toma `token` por query
- `player/sync.py:79` llama `/api/device/status?token=...`
- `player/sync.py:540` llama `/api/media/download/{id}?token=...`
- `web/app/api/device/sync/route.ts:143` genera URLs con token embebido
- `web/public/sync.py:61` repite patrón

Impacto:

- Los tokens quedan en logs de servidores, proxies, historial, traces, etc.

Cambios necesarios:

- Mover autenticación del device a header (`Authorization: Bearer ...` o `X-Device-Token`).
- Evitar URLs presignadas con token reutilizable; usar URLs cortas firmadas por request si hace falta.

Estado (24/02): RESUELTO parcialmente (migración a header aplicada + fallback legacy)

- `web/lib/device-token-request.ts` centraliza extracción de token de device desde:
  - `X-Device-Token`
  - `Authorization: Bearer ...`
  - fallback temporal `?token=` (compatibilidad)
- `web/app/api/device/status/route.ts` y `web/app/api/media/download/[id]/route.ts` ya aceptan headers y dejan de depender exclusivamente de query params.
- `web/app/api/device/sync/route.ts` ya no embebe `?token=` en URLs de media enviadas al player.
- `player/sync.py` migrado:
  - `poll_status()` usa `X-Device-Token`
  - descargas internas `/api/media/download/*` envían `X-Device-Token` por header
  - evita filtrar token a URLs externas (solo agrega header en same-origin endpoints internos)
- `web/public/sync.py` (cliente legacy expuesto) también migrado a header para `status` y descargas internas.
- Tests agregados/actualizados:
  - `web/__tests__/api/device-status-route.test.ts`
  - `web/__tests__/api/media-download-route.test.ts`
  - `web/__tests__/api/device-heartbeat-sync.test.ts`
  - `player/tests/test_sync.py`
- Pendiente para cierre total del hallazgo: eliminar fallback de `?token=` en backend después de migrar todos los players desplegados (y comunicar ventana de deprecación).

### 10) `device/register` filtra detalles internos y maneja mal colisiones de pairing code

Evidencia:

- `web/app/api/device/register/route.ts:12` rate limit por `x-forwarded-for` sin parse robusto
- `web/app/api/device/register/route.ts:23` genera código de 6 dígitos
- `web/app/api/device/register/route.ts:31` intenta crear con `pairingCode` único
- `web/app/api/device/register/route.ts:47` devuelve `error.message` en 500 (`details`)

Impacto:

- Colisión de `pairingCode` (DB unique) produce 500 innecesario.
- Se exponen detalles internos al cliente.

Cambios necesarios:

- Parsear IP correctamente (primer IP confiable) o usar headers validados por plataforma.
- Implementar retry en colisión (N intentos).
- No retornar `details` de excepciones en respuestas públicas.

Estado (24/02): RESUELTO

- `web/app/api/device/register/route.ts` ahora:
  - usa generación de pairing code encapsulada y reintenta colisiones `P2002` (hasta 5 intentos)
  - devuelve `503` genérico si se agotan retries de colisión (en vez de 500 por colisión transitoria)
  - no expone `error.message`/`details` en respuestas `500`
- El parseo de IP/rate-limit key robusta quedó cubierto por el fix de `#5` (`web/lib/rate-limit-key.ts` + `rateLimitKeyForIp()`).
- Test agregado: `web/__tests__/api/device-register-route.test.ts` (éxito, rate-limit, retry por colisión, retries agotados y sanitización de errores).

### 11) Inicio de sesión sync devuelve `startTimeoutMs` pero no hay enforcement server-side

Evidencia:

- `web/app/api/sync/session/start/route.ts:17` `INITIAL_START_HOLD_MS = 12h`
- `web/app/api/sync/session/start/route.ts:223` calcula `timeoutAtMs`
- `web/app/api/sync/session/start/route.ts:297` / `:298` solo lo devuelve en response
- No se encontró lógica server-side que aborte por timeout de arranque

Impacto:

- Sesiones pueden quedar colgadas en `STARTING` si no llegan a `READY`.
- Operación manual requerida y estados zombies.

Cambios necesarios:

- Implementar timeout real (cron/job/heartbeat-driven) que marque `ABORTED` y emita `SYNC_STOP`.
- Persistir `startTimeoutMs/timeoutAtMs` en DB si se va a usar operativamente.

Estado (24/02): RESUELTO

- Se agregÃ³ persistencia de timeout en `SyncSession` (`startTimeoutAtMs`) y migraciÃ³n SQL:
  - `web/prisma/schema.prisma`
  - `web/prisma/migrations/20260224153000_add_sync_session_start_timeout/migration.sql`
- Nuevo servicio `web/lib/sync-start-timeout-service.ts`:
  - detecta sesiones en `CREATED/STARTING` vencidas por `startTimeoutAtMs`
  - marca `ABORTED` + `stoppedAt`
  - marca `SyncSessionDevice` como `DISCONNECTED` (excepto `ERRORED`)
  - encola `SYNC_STOP` con reason `TIMEOUT`
- Enforcement conectado en rutas/flujos reales:
  - `web/app/api/sync/session/start/route.ts` (limpia sesiones vencidas antes de crear nuevas y persiste timeout)
  - `web/app/api/sync/session/active/route.ts` (no devuelve sesiones zombies)
  - `web/lib/sync-runtime-service.ts` (aborta y corta procesamiento runtime si la sesiÃ³n ya expirÃ³)
- Tests agregados/actualizados:
  - `web/__tests__/lib/sync-start-timeout-service.test.ts`
  - `web/__tests__/api/sync-runtime-service.test.ts`
  - `web/__tests__/api/sync-session-start-stop.test.ts`

## Hallazgos medios

### 12) `devices` API sobreexpone datos (incluyendo token) y escala mal con muchos media items

Evidencia:

- `web/app/api/devices/route.ts:19` usa `findMany` sin `select` en `Device` (incluye campos sensibles como `token`)
- `web/app/api/devices/route.ts:91` mapea `device` completo
- `web/app/api/devices/route.ts:98` hace spread de `deviceBase` al JSON
- `web/app/api/devices/route.ts:63` carga **todos** los media del usuario para inferir preview

Impacto:

- Exposición innecesaria de `device.token` al frontend.
- Query cost alto y latencia creciente con el catálogo de media.

Cambios necesarios:

- Usar `select` explícito y excluir `token` por defecto.
- Resolver preview por join/lookup más acotado (o cachear mapeo por filename).
- Separar endpoint admin/diagnóstico si realmente necesitás devolver token.

Estado (24/02): RESUELTO

- `web/app/api/devices/route.ts` ahora usa `select` explicito en `prisma.device.findMany()` y excluye `token` (y otros campos no necesarios).
- Se agrego sanitizacion defensiva en el mapeo de respuesta para no filtrar `token`/`userId` aunque el `select` se amplie en el futuro.
- La resolucion de `contentPreview` ya no consulta todo el catalogo:
  - si no hay `currentContentName` en devices, no ejecuta query a `mediaItem`
  - si hay, consulta solo `name`/`filename` referenciados por esos devices
- Test agregado: `web/__tests__/api/devices-route.test.ts` (401, no leak de token, query de media acotada).

### 13) `devices/[id]` y `playlists/[id]` devuelven mensajes internos de error al cliente

Evidencia:

- `web/app/api/devices/[id]/route.ts:103`
- `web/app/api/playlists/[id]/route.ts:140`

Impacto:

- Filtrado de detalles de Prisma/DB/stack hacia clientes autenticados.

Cambios necesarios:

- Responder mensajes genéricos.
- Loggear detalle solo en servidor (con correlation id).

Estado (24/02): RESUELTO

- `web/app/api/devices/[id]/route.ts` (PUT) ya no devuelve `error.message` en `500`; responde `{ error: "Failed to update device" }`.
- `web/app/api/playlists/[id]/route.ts` (PUT) ya no expone `details`; responde `{ error: "Failed to update playlist" }`.
- Se conserva logging detallado en servidor (`console.error(...)`) para diagnostico.
- Tests de regresion:
  - `web/__tests__/api/device-update-route.test.ts`
  - `web/__tests__/api/update-playlist-route.test.ts` (caso nuevo de sanitizacion)

### 14) `schedules/[scheduleId]` PATCH sin schema fuerte y validación temporal incompleta

Evidencia:

- `web/app/api/schedules/[scheduleId]/route.ts:81`, `:82` parseo JSON libre
- `web/app/api/schedules/[scheduleId]/route.ts:98` validación manual parcial
- `web/app/api/schedules/[scheduleId]/route.ts:136` solo chequea overlap simple (`next.start < current.end`)
- `web/app/api/schedules/[scheduleId]/route.ts:154` persiste `items` sin normalización estricta

Impacto:

- Acepta payloads mal formados.
- No valida explícitamente `startTime < endTime`.
- Casos edge (intervalos inválidos/overnight) pueden entrar y romper lógica del player.

Cambios necesarios:

- Agregar Zod schema específico para PATCH.
- Validar `dayOfWeek`, formato HH:MM, `start < end`, y política para intervalos overnight.
- Normalizar/sortear items antes de persistir.

Estado (24/02): RESUELTO

- `web/lib/validations.ts` ahora define `UpdateScheduleSchema` (Zod) y `ScheduleItemSchema` compartido con validacion fuerte y `.strict()`.
- Se normalizan horarios a `HH:MM` (ej. `9:50` -> `09:50`) para evitar inconsistencias y errores de ordenamiento.
- Se valida explicitamente `endTime > startTime` (politica actual: no se permiten intervalos overnight).
- `web/app/api/schedules/[scheduleId]/route.ts` usa el schema de PATCH y reemplaza el overlap check lexicografico por comparacion numerica en minutos.
- Tests de regresion en `web/__tests__/api/schedule-patch.test.ts`:
  - `endTime <= startTime` rechaza `400`
  - overlap con horas no padded (`9:50` vs `10:00`) ahora se detecta correctamente

### 15) `media/upload` no define límites de tamaño/cuota a nivel de token de subida

Evidencia:

- `web/app/api/media/upload/route.ts:19` solo restringe `allowedContentTypes`
- `web/app/api/media/upload/route.ts:25` `onUploadCompleted` vacío

Impacto:

- Riesgo de abuso de storage/costos por uploads grandes (usuario autenticado).

Cambios necesarios:

- Definir límites de tamaño por tipo/usuario.
- Registrar metadata/ownership/verificación post-upload.
- Validar quota y rate limit por usuario.

Estado (24/02): RESUELTO parcialmente

- Se definio limite maximo de subida por token en `web/app/api/media/upload/route.ts` usando `maximumSizeInBytes` = `2 GB` (`2147483648` bytes).
- Se agrego constante compartida `web/lib/media-upload-policy.ts` para evitar drift entre endpoints.
- Defensa en profundidad: `web/lib/validations.ts` (`CreateMediaItemSchema`) ahora rechaza metadata con `size` > `2 GB`, aunque el token de upload se bypass�e.
- Tests agregados/actualizados:
  - `web/__tests__/api/media-upload-route.test.ts` (verifica `maximumSizeInBytes` en token)
  - `web/__tests__/api/create-media.test.ts` (rechazo de `size` > 2 GB)
- Pendiente para cierre total del hallazgo original: cuota acumulada por usuario y verificacion/registro post-upload en `onUploadCompleted`.

### 16) `contact` endpoint: rate limit basado en headers spoofeables y webhook sin timeout

Evidencia:

- `web/app/api/contact/route.ts:13` confía en `x-forwarded-for`
- `web/app/api/contact/route.ts:18` fallback `x-real-ip`
- `web/app/api/contact/route.ts:118` `fetch(webhookUrl, ...)` sin timeout/AbortSignal

Impacto:

- Rate-limit menos confiable.
- Un webhook lento puede colgar requests y afectar disponibilidad.

Cambios necesarios:

- Usar IP provista por plataforma o header de confianza validado.
- Agregar timeout y retries acotados al webhook.
- Considerar cola asíncrona para entrega (SMTP/webhook).

Estado (24/02): RESUELTO parcialmente

- `web/app/api/contact/route.ts` ahora usa timeout real para webhook (`AbortController` + `signal`) con `CONTACT_WEBHOOK_TIMEOUT_MS` (default 5000ms, clamp 500-30000).
- Si el webhook excede el timeout, se aborta y se registra error controlado (sin colgar indefinidamente el request).
- Se agrego rate-limit adicional por fingerprint del lead (`email` + `phone` hasheados) via `rateLimitKeyForContactLead(...)`, para no depender solo de IP/header spoofeable.
- `web/lib/rate-limit-key.ts` agrega helper de key hasheada para contacto.
- `.env.example` documenta `CONTACT_WEBHOOK_TIMEOUT_MS`.
- Tests agregados/actualizados:
  - `web/__tests__/api/contact.test.ts` (segundo rate-limit, `signal` en webhook, manejo de timeout)
  - `web/__tests__/lib/rate-limit-key.test.ts` (hash de contact lead)
- Pendiente para cierre total del hallazgo: retries acotados/cola asincrona y una politica explicita de trusted proxy headers por entorno.

### 17) Failover de master sync usa `dedupeKey` no versionado por evento

Evidencia:

- `web/lib/sync-master-election.ts:332`

Impacto:

- Un failover posterior al mismo master dentro de la misma sesión puede quedar deduplicado indebidamente.

Cambios necesarios:

- Incluir `electionAtMs` (o contador de elección) en `dedupeKey` de `MASTER_FAILOVER`.

Estado (24/02): RESUELTO

- `web/lib/sync-master-election.ts` ahora versiona el `dedupeKey` de `MASTER_FAILOVER` por evento incluyendo `electionAtMs` (`nowMs`) y transicion `from->to`.
- Esto evita que un failover posterior dentro de la misma sesion (mismo master destino) quede deduplicado por error.
- Se mantiene deduplicacion util dentro del mismo evento de eleccion.
- Test actualizado: `web/__tests__/api/sync-master-failover.test.ts` verifica `dedupeKey` con timestamp y `from/to`.

### 18) Prisma datasource usa URL unpooled tanto para `url` como para `directUrl`

Evidencia:

- `web/prisma/schema.prisma:7`
- `web/prisma/schema.prisma:8`

Impacto:

- Riesgo de agotamiento de conexiones en despliegues serverless (según topología real).

Cambios necesarios:

- Usar URL pooled para `url` y unpooled solo en `directUrl` (si trabajás con Neon/Vercel/Prisma Migrate).

## Hallazgos bajos / deuda operativa

### 19) `player` usa `--no-sandbox` en Chromium bajo ciertas condiciones

Evidencia:

- `player/player.py:727`
- `player/player.py:756`

Impacto:

- Si el servicio corre como root o se habilita `ALLOW_CHROMIUM_NO_SANDBOX`, se reduce seguridad del browser kiosk.

Cambios necesarios:

- Garantizar ejecución como usuario no-root (ya está en `setup_service.sh`) y dejar `ALLOW_CHROMIUM_NO_SANDBOX` deshabilitado.
- Agregar log/telemetría explícita para detectar si se activa en campo.

### 20) LAN beacons de sync no están autenticados (spoofing en LAN)

Evidencia:

- `player/lan_sync.py:222` construye beacon JSON
- `player/lan_sync.py:232` broadcast UDP
- `player/lan_sync.py:267` follower parsea JSON recibido
- `player/lan_sync.py:273` valida solo `session_id` y `master_device_id`

Impacto:

- En una LAN hostil, un actor puede inyectar beacons falsos si conoce/observa IDs.

Cambios necesarios:

- Firmar beacons (HMAC con secreto efímero por sesión) o encapsular en canal autenticado.
- Al menos agregar nonce/versión y validación temporal estricta.

### 21) `player/sync.py` descarga legacy sin archivo temporal (puede dejar archivos corruptos)

Evidencia:

- `player/sync.py:484` path directo
- `player/sync.py:496` descarga y escribe directo

Impacto:

- Cortes de red pueden dejar archivos parciales con nombre final válido.

Cambios necesarios:

- Reusar la estrategia `.part` + `os.replace` que ya existe en `ensure_sync_media_available`.

### 22) `player/sync.py` usa read timeout infinito en descarga sync

Evidencia:

- `player/sync.py:540`
- `player/sync.py:558`

Impacto:

- Una transferencia colgada puede bloquear el flujo indefinidamente.

Cambios necesarios:

- Configurar `read timeout` finito y retries controlados.

### 23) Wrappers de ejecución usan `shell=True` con comandos armados dinámicamente

Evidencia:

- `execution/run_script.py:35`
- `execution/run_tests.py:108`
- `execution/web_ops.py:33`
- `execution/web_ops.py:52`

Impacto:

- Riesgo de quoting/inyección (especialmente `run_script.py`) y comportamiento inconsistente cross-platform.

Cambios necesarios:

- Usar `shell=False` con listas de argumentos.
- Sanitizar/whitelistear comandos permitidos.

### 24) Defaults de QA apuntan a producción

Evidencia:

- `qa_automation/playwright.config.ts:3`
- `qa_automation/playwright.config.ts:6`

Impacto:

- Riesgo de ejecutar pruebas contra prod por error local/CI si falta `E2E_BASE_URL`.

Cambios necesarios:

- Forzar `E2E_BASE_URL` explícito en prod tests o usar un valor dummy que falle si no está seteado.

### 25) Instaladores/documentación usan `curl | bash` desde branch `master` y repo hardcodeado

Evidencia:

- `README.md:45`
- `player/INSTALL_INSTRUCTIONS.md:55`
- `web/public/install.sh:13`
- `web/public/install.sh:21`
- `player/setup_device.sh:52`
- `player/setup_device.sh:61`
- `player/setup_device.sh:92`

Impacto:

- Supply-chain risk (sin pin de commit/tag/checksum).
- Drift entre repositorio actual y script remoto hardcodeado.
- URL de backend hardcodeada antigua en instalador.

Cambios necesarios:

- Distribuir instaladores por release/tag firmado o commit pinneado.
- Verificar checksum.
- Centralizar URL de backend en config/bootstrap, no hardcodear en scripts/docs.

### 26) Código duplicado y expuesto en `web/public/sync.py`

Evidencia:

- `web/public/sync.py:7`, `web/public/sync.py:61`, `web/public/sync.py:158`
- Diff local confirma que es una copia divergente de `player/sync.py` (no canónica)

Impacto:

- Riesgo de drift funcional/seguridad.
- Se expone públicamente un cliente Python legacy con patrones inseguros.

Cambios necesarios:

- Eliminar o reemplazar por artefacto versionado/documentado.
- Si se mantiene, generar desde fuente canónica y revisar seguridad.

### 27) Problemas de encoding / mojibake en scripts operativos (UX / soporte)

Evidencia:

- `setup_env.ps1:12` muestra texto mojibake (`âš ï¸`)
- También se observan caracteres dañados en otros scripts/outputs según terminal

Impacto:

- Mala UX operativa y señales de inconsistencia de encoding.

Cambios necesarios:

- Estandarizar UTF-8 (preferentemente UTF-8 with BOM para PowerShell si el entorno lo requiere).
- Evitar emojis en scripts CLI si el entorno objetivo no lo soporta bien.

## Estado de calidad del frontend (`web`) y build pipeline

### Lint

`npm run lint` falla con errores reales y de configuración/alcance:

- Errores en rutas y componentes con `any` (ej. `web/app/api/playlists/[id]/route.ts`, `web/app/api/schedules/[scheduleId]/route.ts`)
- Hooks anti-pattern (`react-hooks/set-state-in-effect`) en:
  - `web/app/login/page.tsx:17`
  - `web/components/devices/device-row.tsx:43`
  - `web/components/ui/duration-input.tsx:45`
- Reglas aplicadas a scripts/config (`require()` prohibido) generan ruido en:
  - `web/scripts/*.js`
  - `web/jest.config.js`
  - `web/jest.setup.js`

Cambios necesarios:

- Corregir errores reales de código.
- Ajustar ESLint config/overrides para scripts CommonJS y archivos de test config.
- Hacer `lint` gating obligatorio en CI.

### Build de producción

Observación verificada:

- `next build` falló inicialmente por typings Prisma desactualizados (error en `web/app/api/devices/route.ts:96` y `web/lib/device-cpu-telemetry.ts:27`).
- Tras `npx prisma generate`, el build pasó.

Interpretación:

- No es necesariamente bug de lógica; sí es una **fragilidad operativa**.

Cambios necesarios:

- Asegurar `prisma generate` en CI/build step (además de `postinstall`).
- Evitar caches de `node_modules`/Prisma client inconsistentes sin invalidación por cambios en `schema.prisma`.

## Dependencias y seguridad de supply chain

### `next` con vulnerabilidad reportada por `npm audit`

Evidencia:

- `web/package.json:29` usa `next@16.1.4`
- `npm audit --omit=dev` reporta advisory(s) sobre `next` con fix en `16.1.6`

Cambios necesarios:

- Actualizar a `next@16.1.6` (mínimo) y validar regresiones.

### Dependencias Python del player no pinneadas

Evidencia:

- `player/install_dependencies.sh` instala paquetes vía `apt`/`pip3` sin version pinning estricto
- `player/setup_device.sh` instala runtime dependencies directo en el equipo

Impacto:

- Reproducibilidad limitada entre instalaciones.

Cambios necesarios:

- Definir versiones mínimas/pinneadas para runtime Python.
- Considerar imagen base o script de provisioning versionado.

## Higiene de secretos (workspace local)

Hallazgo verificado:

- Existen múltiples archivos `.env*` en `web/` con valores sensibles reales en el workspace local (`web/.env`, `web/.env.prod.synccheck`, `web/.env.production.vercel`).
- `git check-ignore` confirma que **están ignorados** por Git (no versionados), pero siguen siendo un riesgo operativo local si se comparten/exportan logs/backups.

Acción inmediata recomendada:

- Rotar credenciales/tokens sensibles encontrados localmente si fueron reutilizados o compartidos (DB, NextAuth, Vercel OIDC, Blob token, etc.).
- Eliminar archivos exportados de Vercel de estaciones de trabajo cuando no sean necesarios.

Nota:

- `git ls-files` mostró `web/test_device_token.txt` como versionado (vacío en esta revisión). No es un secreto hoy, pero conviene documentar mejor su propósito o eliminarlo si no se usa.

## Plan de remediación recomendado (orden)

### Fase 0 (inmediata, bloqueo prod)

1. Corregir path traversal / validación de `filename` y `url` (`web` + `player`)
2. Corregir authz de media ownership en `PUT /api/playlists/[id]`
3. Corregir ACK para prohibir `PENDING`
4. Corregir expiración admin en middleware
5. Eliminar `details` en errores públicos y limpiar logs debug en rutas críticas

### Fase 1 (hardening y operación)

1. Migrar rate limiting a backend distribuido
2. Endurecer CSP (prod)
3. Remover/proteger endpoints debug
4. Implementar timeout server-side para sync session start
5. Sacar tokens de query params

### Fase 2 (calidad y release readiness)

1. Dejar `npm run lint` en verde
2. Actualizar `next` a `16.1.6+`
3. Ajustar pipeline `prisma generate` / invalidación de cache
4. Corregir QA defaults para no apuntar a prod por defecto
5. Reemplazar instaladores `curl|bash` por releases pinneados

## Conclusión

El proyecto tiene una base funcional sólida en varias áreas (tests de `web` y `player` pasan), pero todavía presenta **riesgos de seguridad y consistencia significativos** para un entorno real. Con las remediaciones de Fase 0 y Fase 1, el sistema puede quedar en condiciones mucho más robustas para producción.

## Addendum: Verificación Diseño/Documentación vs Implementación (Sync/VideoWall)

Esta sección responde a la revisión específica de lógica funcional vs documentación (features de diseño) y agrega hallazgos de consistencia.

### Verificaciones positivas (cumple la documentación)

#### A) Sync startup espera descarga de media faltante antes de `READY` / reproducción

Documentación:

- `agent_directives/context/project/PROJECT.md:177`-`179` define que el startup Sync debe esperar descargas faltantes antes de `READY`.

Implementación verificada:

- `player/videowall_controller.py:441`-`450` intenta `ensure_sync_media_available(...)` cuando el archivo no está local.
- Recién después continúa el flujo de sesión y estados (`activate`, `PRELOADING`, clock check, start playback, `READY`) en `player/videowall_controller.py:515`-`553`.

Conclusión:

- **Sí, está implementado**: si el media del `SYNC_PREPARE` no existe localmente, el player espera la descarga antes de quedar `READY`/arrancar playback.

#### B) El player solo entra en `READY` si el reloj está sano (`chronyc`)

Documentación:

- `player/INSTALL_INSTRUCTIONS.md:94` lo establece explícitamente.

Implementación verificada:

- `player/videowall_controller.py:529`-`535` bloquea el flujo si `clock_health.critical` y pasa a `ERRORED`.
- `READY` ocurre recién después en `player/videowall_controller.py:549`-`553`.

Conclusión:

- **Sí, está implementado** y coherente con la documentación operativa.

#### C) UI muestra `downloading media` durante `SYNC_PREPARE` pendiente

Documentación:

- `agent_directives/context/project/PROJECT.md:179`

Implementación verificada:

- Backend expone `prepareCommandPendingByDeviceId` en `/api/sync/session/active` (`web/app/api/sync/session/active/route.ts:91`-`110`)
- UI lo usa para renderizar badge `downloading media` (`web/components/dashboard/sync-videowall-panel.tsx:1501`-`1530`)

Conclusión:

- **Sí, está implementado** a nivel UX (con una salvedad de estados observables, ver hallazgo siguiente).

### Hallazgos nuevos de lógica / consistencia documentación-implementación

#### 28) La secuencia de estados documentada (`ASSIGNED -> PRELOADING -> READY -> ...`) no siempre es observable externamente

Documentación que lo afirma:

- `docs/features_y_flujos.md:153`
- `docs/sync_qa_runbook.md:17`

Problema de implementación (orden real):

- `player/videowall_controller.py:386`-`394` ejecuta `tick()` en orden: `_poll_commands()` -> `_advance_runtime_state()` -> `_report_status()`
- `player/videowall_controller.py:407`-`415` procesa `SYNC_PREPARE` y recién **después** hace `ack_device_command(...)`
- El download de media faltante ocurre dentro de `_handle_prepare` antes del alta de estado (`player/videowall_controller.py:441`-`450`)
- `PRELOADING` se transiciona después (`player/videowall_controller.py:526`)
- El mismo `_handle_prepare` puede llegar a `READY` antes del ACK (`player/videowall_controller.py:549`-`553`)
- El ACK persiste el estado recibido (`web/app/api/device/ack/route.ts:56`-`63`)

Efecto observable:

- En startup con descarga faltante, backend/UI pueden ver al device quedarse en `ASSIGNED` (con badge `downloading media`) y luego saltar a `READY`, sin un `PRELOADING` claramente persistido.

Impacto:

- No rompe el feature principal (esperar descarga), pero **sí rompe parcialmente la expectativa documental/QA** de secuencia de estados visible.

Cambio recomendado:

- Opción 1 (código): emitir/persistir estado `PRELOADING` antes de iniciar descarga (ej. heartbeat/ack parcial o transición+status report previo).
- Opción 2 (docs): aclarar que `PRELOADING` es estado lógico local y que externamente puede verse `ASSIGNED + downloading media` hasta el ACK final.

#### 29) Métricas de drift pueden contaminarse con muestras `0.0` antes de tener drift real

Implementación relevante:

- `player/videowall_controller.py:868` envía `drift_ms = 0.0` cuando todavía no existe `_last_drift_ms`
- `web/lib/sync-runtime-service.ts:192` solo descarta `null/undefined` (no descarta `0`)
- `web/lib/sync-runtime-service.ts:242`-`248` persiste esa muestra en `driftHistory`

Impacto:

- Se insertan ceros iniciales (por ejemplo en `READY` temprano / ACK de prepare) que pueden sesgar `avg`, percentiles y calidad percibida.
- Esto afecta coherencia con el objetivo operativo documentado de drift (`docs/sync_qa_runbook.md`) y el resumen persistido de sesión.

Cambio recomendado:

- Enviar `drift_ms = null` hasta tener la primera muestra real (o persistir drift solo en `WARMING_UP/PLAYING`).
- Alternativamente, filtrar por estado en `persistDeviceSyncRuntime` antes de agregar a `driftHistory`.

#### 30) Endpoint legacy `POST /api/device/preview` quedó colgado (duplicado funcional con heartbeat)

Evidencia:

- El player moderno reporta preview/estado por `heartbeat` (`player/sync.py:195`-`241`)
- No se encontraron referencias de código fuente (excluyendo `.next`) a `/api/device/preview`
- Existe ruta `web/app/api/device/preview/route.ts` con lógica casi duplicada de upload preview

Impacto:

- Superficie de API innecesaria y riesgo de drift funcional/seguridad entre dos rutas que hacen casi lo mismo.

Cambio recomendado:

- Deprecar y eliminar `/api/device/preview` (o dejar wrapper explícito y documentado), consolidando todo en `/api/device/heartbeat`.

#### 31) `web/public/sync.py` expone un cliente legacy que no coincide con el diseño canónico de Sync/VideoWall

Diseño canónico documentado:

- `agent_directives/context/project/PROJECT.md` define control plane Sync con `/api/device/commands`, `/api/device/ack`, `/api/device/heartbeat`, `/api/device/logs`

Implementación legacy expuesta:

- `web/public/sync.py:126`-`137` usa solo `/api/device/sync` (polling legacy de playlist)
- No tiene command queue / ACK / runtime sync health / LAN mode

Impacto:

- Puede inducir a instalar o reutilizar un cliente incompatible con el flujo actual de Sync/VideoWall.
- Inconsistencia entre documentación canónica y artefactos públicos servidos por `web`.

Cambio recomendado:

- Retirar `web/public/sync.py` o reemplazarlo por un artefacto claramente etiquetado como legacy/no soportado.
- Mantener una única fuente canónica (`player/`).

#### 32) Inconsistencia documental menor en pairing: “código alfanumérico” vs implementación numérica de 6 dígitos

Documentación:

- `docs/features_y_flujos.md:39` menciona “código alfanumérico”

Implementación:

- `web/app/api/device/register/route.ts:22`-`23` genera código numérico de 6 dígitos
- `web/app/api/device/pair/route.ts:8` valida longitud 6, no alfanumérico específico

Impacto:

- Bajo (documentación), pero genera confusión operativa/QA.

Cambio recomendado:

- Actualizar docs para decir “código numérico de 6 dígitos” (o cambiar implementación si se busca alfanumérico real).

### Nota de implementación (relevante para tu ejemplo)

Tu ejemplo puntual (esperar archivos antes de reproducir) está **cumplido**, pero la señalización externa del estado (`PRELOADING`) está implementada de forma indirecta:

- El sistema lo refleja visualmente con `downloading media` basado en comando pendiente (`SYNC_PREPARE`) + estado `ASSIGNED/PRELOADING`
- No necesariamente como transición persistida estricta `ASSIGNED -> PRELOADING` en backend para todos los casos

Esto conviene dejarlo explícito en documentación y runbooks para evitar falsos negativos en QA.

## Addendum - Audit de logica de Heartbeat (24/02/2026)

Objetivo de este addendum:

- Verificar consistencia de la logica de `heartbeat` a lo largo del proyecto (`player`, `web`, UI/docs)
- Identificar ineficiencias y riesgos de comportamiento en entorno real
- Contrastar contra buenas practicas externas (heartbeats / keepalive / health checking)

### Mapa real del comportamiento actual (verificado en codigo)

- El player envia `heartbeat` por `POST /api/device/heartbeat` desde `report_playback_state(...)` (`player/sync.py:183`, `player/sync.py:195`, `player/sync.py:241`).
- Existe un thread de reporte periodico general cada ~5s (`preview_report_loop`) que envia heartbeat sin screenshot (`preview_path=None`) y sin `sync_runtime` (`player/player.py:55`, `player/player.py:144`, `player/player.py:148`-`151`, `player/player.py:1065`).
- En Sync/VideoWall, ademas, `VideowallController` envia heartbeats con `sync_runtime` en estado activo (`player/videowall_controller.py:383`, `player/videowall_controller.py:392`, `player/videowall_controller.py:881`, `player/videowall_controller.py:900`).
- La cadencia de heartbeat runtime en Sync/VideoWall varia por estado:
  - `READY`/`WARMING_UP`: ~2s (`player/videowall_controller.py:60`, `player/videowall_controller.py:169`-`177`)
  - `PLAYING`: ~5s cloud / ~10s follower LAN (`player/videowall_controller.py:61`, `player/videowall_controller.py:72`, `player/videowall_controller.py:169`-`177`)
- Backend `heartbeat` actualiza liveness de `Device` (`status="online"`, `lastSeenAt`) y en la misma request puede:
  - procesar preview upload a Blob
  - persistir `sync_runtime`
  - intentar rejoin de sync si no viene `sync_runtime`
  - ejecutar chequeo de reeleccion de master si si viene `sync_runtime`
  (`web/app/api/device/heartbeat/route.ts:90`-`91`, `web/app/api/device/heartbeat/route.ts:107`-`116`, `web/app/api/device/heartbeat/route.ts:140`-`152`)
- El estado online/offline de UI usa ventana de 15s con heartbeat esperado ~5s (`web/lib/device-connectivity.ts:4`-`5`).

### Buenas practicas externas relevadas (y como aplican)

Resumen (parafraseado) de fuentes externas consultadas:

- RabbitMQ recomienda timeouts de heartbeat en un rango moderado (aprox. 5-20s en muchos entornos), y advierte que valores muy bajos elevan falsos positivos.
- gRPC distingue explicitamente `keepalive` (conexion) de `health checking` (salud/servicio) y advierte contra keepalives demasiado agresivos por costo/abuso.
- AWS (Builders Library) recomienda backoff con jitter para evitar picos sincronizados de trafico cuando muchos clientes reintentan/reportan en el mismo intervalo.
- Azure IoT describe que heartbeats custom generan costo/cuota y sugiere evaluar cuidadosamente la frecuencia y el trabajo asociado por mensaje.
- Kubernetes separa `liveness`, `readiness` y `startup` probes para no mezclar senales de salud con otras responsabilidades.

Aplicacion al proyecto:

- La eleccion `5s heartbeat / 15s online window` es razonable, pero debe documentarse como contrato canonicamente (hoy hay docs contradictorias).
- El `heartbeat` deberia ser una ruta liviana y predecible; hoy mezcla liveness + telemetria + coordinacion + preview upload.
- Falta jitter (en player y en polls UI), lo que puede producir rafagas sincronizadas en flotas reales.

Fuentes externas (consultadas):

- RabbitMQ Heartbeats: https://www.rabbitmq.com/docs/heartbeats
- gRPC Keepalive: https://grpc.io/docs/guides/keepalive/
- AWS Builders Library (timeouts/retries/backoff/jitter): https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- Azure IoT device heartbeats / custom heartbeat tradeoffs: https://learn.microsoft.com/en-us/azure/iot-hub/monitor-device-connection-state
- Kubernetes probes (liveness/readiness/startup): https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/

### Hallazgos nuevos (heartbeat) - consistencia y eficiencia

#### 33) Doble emisor de heartbeat durante Sync/VideoWall (thread general + controller sync) genera trabajo redundante y senales mezcladas

Evidencia:

- Thread general siempre activo envia heartbeat cada ~5s (`player/player.py:55`, `player/player.py:144`, `player/player.py:148`-`151`, `player/player.py:1065`)
- Main loop sigue ejecutando `videowall_controller.tick()` aunque Sync este activo (`player/player.py:1080`-`1082`)
- `VideowallController` envia su propio heartbeat con `sync_runtime` (`player/videowall_controller.py:881`, `player/videowall_controller.py:900`)

Impacto:

- Durante una sesion Sync, el backend recibe heartbeats duplicados del mismo device con semantica distinta:
  - uno sin `sync_runtime` (thread general)
  - otro con `sync_runtime` (controller)
- Esto aumenta carga innecesaria y complica la interpretacion de senales (especialmente el branch de rejoin vs branch de failover en backend).

Cambio recomendado:

- Unificar a un solo emisor de heartbeat por device.
- Opcion pragmatica: suspender `preview_report_loop` cuando `videowall_controller.is_active()` sea `true`.
- Opcion mejor: crear un scheduler unico de heartbeat que adjunte `sync_runtime` solo cuando exista, con una sola cadencia y una sola cola de envio.

#### 34) El endpoint `/api/device/heartbeat` mezcla demasiadas responsabilidades en la ruta de liveness (lento, acoplado, mas fragil)

Evidencia:

- Rate limit + auth + update de `Device` (`web/app/api/device/heartbeat/route.ts:58`, `web/app/api/device/heartbeat/route.ts:90`-`91`)
- Upload opcional a Blob (`web/app/api/device/heartbeat/route.ts:107`-`116`)
- Persistencia de `sync_runtime` (`web/app/api/device/heartbeat/route.ts:140`)
- Rejoin reconciliation (`web/app/api/device/heartbeat/route.ts:143`)
- Master reelection (`web/app/api/device/heartbeat/route.ts:152`)

Impacto:

- Si se degrada una parte (Blob, DB, rejoin query, election query), se degrada tambien la ruta que define liveness.
- Aumenta latencia del heartbeat y riesgo de retries/duplicados bajo carga.
- Dificulta escalar y observar el sistema (una sola ruta hace varias cosas con costo variable).

Cambio recomendado:

- Mantener `heartbeat` como write liviano y deterministic:
  - update de liveness
  - telemetria minima
  - enqueue/flag para trabajos derivados
- Mover `preview upload`, `rejoin reconciliation` y/o `master reelection` a procesamiento asincrono (job queue) o workers periodicos.
- Si se mantiene inline, agregar time budgets estrictos y degradacion controlada (best effort sin afectar 200 del liveness).

#### 35) Todos los intervalos relevantes son fijos (sin jitter), lo que puede sincronizar rafagas en flotas reales

Evidencia:

- Thread general heartbeat fijo de 5s (`player/player.py:55`)
- Heartbeats sync con intervalos fijos por estado (`player/videowall_controller.py:60`-`61`, `player/videowall_controller.py:72`, `player/videowall_controller.py:169`-`177`)
- Poll de sesion activa en UI cada 1.5s (`web/components/dashboard/sync-videowall-panel.tsx:463`)
- Poll de status de devices segun tab (5s/15s) (`web/lib/device-connectivity.ts:4`-`5`, `web/components/dashboard/sync-videowall-panel.tsx:101`, `web/components/dashboard/sync-videowall-panel.tsx:478`, `web/app/dashboard/devices/device-manager.tsx:23`, `web/app/dashboard/devices/device-manager.tsx:56`, `web/components/dashboard/device-preview-grid.tsx:28`, `web/components/dashboard/device-preview-grid.tsx:84`)

Impacto:

- Devices iniciados al mismo tiempo tienden a pegar al backend en la misma ventana de milisegundos.
- La UI tambien puede quedar sincronizada con esos ticks y amplificar picos de consultas.

Cambio recomendado:

- Agregar jitter estable por device (por ejemplo +/-10-20%) en heartbeats y polls de comandos.
- Agregar jitter o backoff suave en polling UI (especialmente `refreshActiveSession`).
- Mantener el SLA de deteccion (15s) pero desfasar envios para evitar thundering herd.

#### 36) El branch de rejoin se ejecuta en cada heartbeat sin `sync_runtime`, incluso para devices fuera de Sync (costo DB innecesario)

Evidencia:

- `heartbeat` llama `maybeQueueSyncRejoinPrepareOnHeartbeat(device.id)` cuando no hay `syncRuntime.sessionId` (`web/app/api/device/heartbeat/route.ts:143`)
- El player general manda heartbeats sin `sync_runtime` en loop permanente (`player/player.py:144`, `player/player.py:148`-`151`)
- `maybeQueueSyncRejoinPrepareOnHeartbeat` hace query de asignacion activa (`web/lib/sync-device-rejoin.ts:88`-`146`)

Impacto:

- Todos los devices (aunque no participen en Sync/VideoWall) pagan una query extra por heartbeat para descubrir que no tienen sesion activa.
- Con 5s por device, el costo escala linealmente con la flota y se vuelve ruido constante de DB.

Cambio recomendado:

- Gatear el rejoin check antes de consultar DB (ejemplos):
  - solo si el device reporta `sync_capable=true` y/o `sync_enabled=true`
  - solo si hubo una asignacion Sync reciente (cache TTL por device)
  - solo si el backend tiene una marca rapida (`device.syncCandidate` / `lastSyncSessionId`)
- Alternativa minima: cache negativo corto (in-memory o Redis) para `NO_ACTIVE_SESSION`.

#### 37) `sync_runtime` se persiste desde multiples endpoints sin control de orden/monotonicidad (riesgo de overwrite tardio)

Evidencia:

- `persistDeviceSyncRuntime(...)` se invoca desde:
  - `heartbeat` (`web/app/api/device/heartbeat/route.ts:140`)
  - `device sync` legacy (`web/app/api/device/sync/route.ts:113`)
  - `device ack` (`web/app/api/device/ack/route.ts:77`)
- `persistDeviceSyncRuntime` actualiza `status`, `lastSeenAt` de `SyncSessionDevice` y metricas sin comparar con un `sent_at`/sequence del cliente (`web/lib/sync-runtime-service.ts:216`-`266`)

Impacto:

- Un request tardio/reintentado puede sobrescribir un estado mas nuevo con uno mas viejo (ej. `READY` despues de `PLAYING`) si llega fuera de orden.
- La probabilidad no es alta en redes estables, pero es una clase de inconsistencia real en entornos distribuidos.

Cambio recomendado:

- Incluir `runtime_sent_at_ms` monotonicamente creciente (o `runtime_seq`) en payloads de `heartbeat`/`ack`.
- Persistir `lastRuntimeSeq`/`lastRuntimeAtMs` por `SyncSessionDevice` y descartar writes viejos.
- Si no se implementa seq, al menos definir reglas de precedencia por estado para evitar regresiones imposibles (`PLAYING -> READY` sin `SYNC_STOP`/rejoin).

Nota:

- Este hallazgo es una inferencia de riesgo basada en el codigo (multiples writers + ausencia de ordering), no una falla ya reproducida en esta auditoria.

#### 38) Inconsistencia de semantica de timeouts: UI "online" (15s) vs failover de master (5s) sin contrato documental explicito

Evidencia:

- Ventana de conectividad general: 15s (`web/lib/device-connectivity.ts:5`)
- Timeout de heartbeat del master para failover: 5s (`web/lib/sync-master-election.ts:6`)

Impacto:

- Un device/master puede verse "online" en UI general mientras el algoritmo de failover ya lo considera stale y reelige master.
- Puede parecer bug para operaciones/QA si no esta documentado como dos niveles distintos de liveness.

Cambio recomendado:

- Documentar explicitamente dos clases de freshness:
  - `device connectivity` (UI general, tolerante)
  - `sync master liveness` (control plane, mas estricto)
- Exponer ambos en UI Sync (ej. `online` + `master heartbeat stale/fresh`) para reducir confusion.

#### 39) Hay contradicciones documentales y comentarios legacy sobre heartbeat que ya no reflejan el sistema actual

Evidencia:

- Documentacion vieja (PRD) todavia afirma heartbeat cada 60s / online < 5 min (`PRD.md:87`-`88`, `PRD.md:783`-`785`)
- Implementacion real usa ~5s / 15s (`web/lib/device-connectivity.ts:4`-`5`)
- Comentario legacy en player afirma que `sync()` actualiza `lastSeenAt` (`player/player.py:928`)
- Pero el backend explicita lo contrario: `/api/device/sync` no actualiza liveness, `heartbeat` es source of truth (`web/app/api/device/sync/route.ts:98`)

Impacto:

- QA y operaciones pueden diagnosticar mal desconexiones o creer que el comportamiento esta roto cuando en realidad cambio el contrato.
- Facilita regresiones futuras por comentarios incorrectos en codigo.

Cambio recomendado:

- Actualizar PRD y docs de acceptance para el contrato actual (5s/15s).
- Corregir comentario en `player/player.py:928`.
- Agregar una seccion "Heartbeat contract" canonica en `PROJECT.md` con:
  - frecuencia nominal
  - timeout UI
  - timeout master failover
  - responsabilidades del endpoint
  - campos minimos del payload

### Recomendaciones priorizadas (heartbeat) para produccion

1. Unificar emision de heartbeat en el player (eliminar duplicidad preview-thread vs sync controller).
2. Hacer `heartbeat` una ruta liviana (liveness + telemetria minima) y mover rejoin/reelection/upload a async o best-effort desacoplado.
3. Agregar jitter a heartbeats/polls (device + UI) para evitar rafagas sincronizadas.
4. Evitar `rejoin` DB check en todos los heartbeats no-sync (gating/caching negativo).
5. Agregar ordering (`runtime_seq` o `runtime_sent_at_ms`) para writes de `sync_runtime`.
6. Documentar contrato canonico de heartbeat y limpiar docs/comentarios legacy.

### Comentario de eficiencia (estado actual vs objetivo)

Lo mas costoso hoy no parece ser el upload de preview (el player actual no esta enviando screenshots en el heartbeat, usa `preview_path=None`), sino:

- duplicidad de heartbeats durante Sync
- queries derivadas de rejoin/reelection en la ruta de heartbeat
- polling UI agresivo (`/api/sync/session/active` cada 1.5s)

Eso significa que hay una mejora de eficiencia clara posible sin tocar la funcionalidad principal: reducir trabajo por heartbeat y desincronizar intervalos.

## Addendum - Audit de logica de Logs (Web + Player) (24/02/2026)

Objetivo de este addendum:

- Revisar la logica de logs del player y del backend web (`ingest`, `persistencia`, `lectura UI`)
- Detectar inconsistencias, fallas de seguridad y riesgos operativos
- Contrastar con buenas practicas externas de logging para produccion

### Mapa real del flujo de logs (verificado)

- El player agrega un handler remoto al root logger en startup (`player/player.py:45`-`46`).
- Ese handler (`LoggerService`) encola logs y los sube por lotes a `POST /api/device/logs` (`player/logger_service.py:48`, `player/logger_service.py:79`, `player/logger_service.py:125`).
- El backend persiste lotes en `DeviceLog` con `createMany(...)` y hace cleanup asyncrono por antiguedad (`web/app/api/device/logs/route.ts:141`, `web/app/api/device/logs/route.ts:158`, `web/app/api/device/logs/route.ts:171`).
- La UI de dashboard consulta `GET /api/devices/:id/logs` (owner-only) y refresca cada 5s (`web/app/api/devices/[id]/logs/route.ts:45`, `web/components/devices/device-logs-modal.tsx:48`).
- Para Sync/VideoWall, hay eventos estructurados (`READY`, `STARTED`, etc.) con enum duplicado en player y web (`player/logger_service.py:10`, `web/types/sync.ts`, `web/app/api/device/logs/route.ts:6`).

### Buenas practicas externas relevadas (y aplicacion)

Resumen (parafraseado) de fuentes oficiales:

- OWASP Logging Cheat Sheet:
  - no loguear secretos/tokens/session identifiers
  - sanitizar entradas para prevenir log injection
  - logging no debe romper la aplicacion si falla el pipeline de logs
  - definir formato/esquema consistente y sincronizacion de tiempo
- OpenTelemetry Logs Data Model:
  - distinguir timestamp del evento (`Timestamp`) y tiempo observado (`ObservedTimestamp`)
  - estandarizar severidad (`SeverityText` + `SeverityNumber`)
- Python logging docs (`QueueHandler` / `QueueListener`):
  - usar handlers asyncronos/colas para desacoplar I/O de logging del thread principal
  - definir estrategia de backpressure/drops y cierre ordenado del listener

Fuentes externas (consultadas):

- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- OpenTelemetry Logs Data Model: https://opentelemetry.io/docs/specs/otel/logs/data-model/
- Python `logging.handlers` (`QueueHandler`/`QueueListener`): https://docs.python.org/3/library/logging.handlers.html
- Python Logging Cookbook (QueueHandler/QueueListener examples): https://docs.python.org/3/howto/logging-cookbook.html

### Hallazgos nuevos (logs) - inconsistencias, seguridad y operacion

#### 40) El logger remoto del player mantiene una cola sin limite antes del pairing y luego puede subir logs sensibles historicos (incluyendo pairing code)

Evidencia:

- Handler remoto se instala al iniciar el player, antes del pairing (`player/player.py:45`-`46`)
- La cola es `queue.Queue()` sin `maxsize` (`player/logger_service.py:48`)
- Si no hay `device_token`, `flush_logs()` retorna sin drenar (`player/logger_service.py:105`)
- El pairing code se loguea en texto plano (`player/player.py:991`)

Impacto:

- Antes de emparejar, la cola puede crecer indefinidamente (riesgo de memoria en dispositivos con fallos/reintentos prolongados).
- Cuando el device finalmente se empareja, se pueden subir retrospectivamente logs de bootstrap/pairing (incluyendo `PAIRING CODE`), exponiendo un secreto operativo que no deberia persistirse centralmente.

Cambio recomendado:

- No instalar el handler remoto hasta tener `device_token`, o filtrar/descartar backlog pre-pairing.
- Hacer la cola acotada (`maxsize`) con politica explicita de drop (oldest/newest) + contador de drops.
- No loguear pairing codes en texto plano (o al menos redaccion parcial).

#### 41) Riesgo de filtracion de `device_token` en logs por loguear respuestas de `/api/device/sync`

Evidencia:

- El backend construye URLs de descarga con `?token=${device_token}` (`web/app/api/device/sync/route.ts:143`)
- El player loguea parte de la respuesta completa del sync (`player/sync.py:165`)
- En errores, tambien loguea `response.text` completo (`player/sync.py:170`, `player/sync.py:176`)

Impacto:

- El `device_token` puede terminar en logs locales (stdout/journal) y remotos (`DeviceLog`) si aparece en el fragmento de respuesta/error.
- Esto viola una practica basica de seguridad de logging (no loguear tokens/credenciales) y amplifica el impacto de acceso a logs.

Cambio recomendado:

- Eliminar log de payload/respuesta completa o redaccionar campos sensibles (`token`, `authorization`, cookies, URLs con query secrets).
- Preferir logs resumidos/estructurados (counts, ids no sensibles, status codes, reasons).

#### 42) Timestamps de logs son inconsistentes: el player emite timestamp local naive y el backend confia en timestamp cliente como `createdAt`

Evidencia:

- El player genera timestamp con `datetime.fromtimestamp(...).isoformat()` (sin timezone explicita) (`player/logger_service.py:67`)
- El backend parsea `timestamp` cliente y lo usa como `createdAt` persistido (`web/app/api/device/logs/route.ts:41`, `web/app/api/device/logs/route.ts:153`)
- `DeviceLog` solo tiene `createdAt` (no `observedAt` / `ingestedAt`) (`web/prisma/schema.prisma:84`)

Impacto:

- Diferencias de timezone/clock skew del device pueden romper el orden real de eventos y confundir analisis.
- El cleanup por antiguedad usa `createdAt`, por lo que timestamps errados del cliente afectan retencion (`web/app/api/device/logs/route.ts:171`).
- Se pierde la distincion entre "cuando ocurrio" y "cuando se recibio" (clave para diagnostico distribuido).

Cambio recomendado:

- En player: emitir timestamp UTC con offset (`datetime.now(timezone.utc).isoformat()`).
- En backend: persistir ambos campos:
  - `eventAt` (cliente, opcional)
  - `observedAt` / `ingestedAt` (server time)
- Usar `observedAt` para orden operativo/retencion y `eventAt` para analisis cuando sea confiable.

#### 43) Inconsistencia de seguridad: `/api/device/logs` no verifica `user.isActive` (cuenta suspendida) como otras rutas de device

Evidencia:

- `heartbeat` valida `device.user.isActive` y rechaza cuentas suspendidas (`web/app/api/device/heartbeat/route.ts:63`, `web/app/api/device/heartbeat/route.ts:66`-`67`, `web/app/api/device/heartbeat/route.ts:76`-`77`)
- `/api/device/logs` solo hace `findUnique({ token })` sin `include user` ni check de suspension (`web/app/api/device/logs/route.ts:114`)

Impacto:

- Devices de cuentas suspendidas pueden seguir escribiendo logs y consumiendo almacenamiento/DB.
- Inconsistencia de politica entre endpoints del mismo canal device.

Cambio recomendado:

- Alinear `/api/device/logs` con `/api/device/heartbeat` y `/api/device/ack` (lookup con `user.isActive` + `403 Account suspended`).

#### 44) Un solo evento Sync desconocido invalida todo el batch, y el player hoy descarta el batch completo en non-200 (pérdida silenciosa por version skew)

Evidencia:

- Backend rechaza el batch completo si existe cualquier `event` no permitido (`web/app/api/device/logs/route.ts:126`-`135`)
- Player/backend mantienen listas de eventos duplicadas (player `SYNC_LOG_EVENTS` y web `SYNC_LOG_EVENT`) (`player/logger_service.py:10`, `web/app/api/device/logs/route.ts:6`)
- Si el upload devuelve non-200, el player no reintenta ni reencola; explicitamente lo descarta (`player/logger_service.py:126`-`128`)

Impacto:

- Un desfasaje de versiones (player nuevo emite evento nuevo, backend viejo lo desconoce) puede causar perdida de TODO el lote de logs, no solo del evento nuevo.
- La falla puede pasar desapercibida porque el player solo imprime error local y sigue.

Cambio recomendado:

- Backend: degradar gracefully (persistir logs validos y marcar/normalizar eventos desconocidos en vez de 400 batch completo).
- O agregar versionado del schema de eventos y compatibilidad hacia atras.
- Player: reencolar con backoff en errores transitorios / respuestas incompatibles (o separar lotes con sync-events de logs genericos).

#### 45) Riesgo de volumen/costo: el limite actual permite hasta 12,000 logs/min por device y no hay limite de tamaño por mensaje/data

Evidencia:

- `device_logs` rate limit = `240/min` (`web/lib/rate-limit.ts:25`)
- Cada request acepta/persiste hasta 50 logs (`web/app/api/device/logs/route.ts:141`)
- `message` se trunca (4000 chars), pero `data` acepta objeto JSON sin cap de tamano/profundidad (`web/app/api/device/logs/route.ts:76`, `web/app/api/device/logs/route.ts:149`-`150`)

Impacto:

- Potencial teorico: `240 * 50 = 12,000` filas/min/device.
- Con flota grande, esto puede generar crecimiento rapido de DB y costos altos, mas carga por `createMany` + cleanup.
- Un device comprometido con token valido puede abusar del canal de logs para storage amplification.

Cambio recomendado:

- Bajar limite efectivo de ingest para logs (rate + batch size) segun SLA real.
- Agregar limite de bytes por request y por `data` (size/depth/keys).
- Introducir sampling para `info/debug` y prioridad para `warning/error`/eventos Sync.

#### 46) La estrategia de retencion/cleanup de logs es inconsistente y costosa (comentario vs implementacion, cleanup por request)

Evidencia:

- Comentario dice "keep last 1000 per device" pero la implementacion borra por antiguedad (>7 dias) (`web/app/api/device/logs/route.ts:164`-`171`)
- `deleteMany(...)` se dispara en cada POST (fire-and-forget) (`web/app/api/device/logs/route.ts:171`)

Impacto:

- Hay contradiccion de criterio de retencion (cantidad vs antiguedad), lo que complica operacion/capacidad.
- Cleanup por request agrega carga constante a DB y hace el costo de ingest variable.

Cambio recomendado:

- Definir politica explicita y documentada (ej. 7 dias + cap por device + cap global).
- Mover cleanup a job programado (cron/worker) con metrics de retencion.
- Si se mantiene inline, ejecutarlo con muestreo probabilistico (ej. 1/N requests).

#### 47) El modal de logs en web tiene una inconsistencia de UI/polling (closure stale) que puede causar `loading` innecesario/flicker

Evidencia:

- `fetchLogs` usa `if (logs.length === 0) setLoading(true)` (`web/components/devices/device-logs-modal.tsx:33`)
- El `useEffect` que define `fetchLogs` no depende de `logs`, pero si dispara polling cada 5s (`web/components/devices/device-logs-modal.tsx:48`)

Impacto:

- `logs.length` dentro del closure puede quedar stale (tipicamente `0`), provocando toggles de loading innecesarios en refrescos periodicos.
- No rompe datos, pero degrada UX y dificulta interpretar si el panel realmente esta recargando.

Cambio recomendado:

- Basar `loading` inicial en un flag separado (`hasLoadedOnce`) o usar updater state sin capturar `logs` stale.

#### 48) Falta sanitizacion defensiva de mensajes para log injection y falta normalizacion estricta de severidad

Evidencia:

- `normalizeMessage(...)` solo hace `trim + slice`, sin sanitizar CR/LF/control chars (`web/app/api/device/logs/route.ts:29`)
- `normalizeLevel(...)` acepta cualquier string (hasta 20 chars), no whitelist (`web/app/api/device/logs/route.ts:18`)
- PRD describe niveles limitados (`INFO|WARNING|ERROR`) (`PRD.md:113`, `PRD.md:668`)

Impacto:

- Riesgo de inyeccion/ensuciamiento de logs (especialmente si luego se exportan a texto plano/SIEM parsers).
- Severidades arbitrarias reducen consistencia de filtros, alertas y visualizacion.

Cambio recomendado:

- Sanitizar `message` (remover/controlar CR/LF y caracteres de control no imprimibles, manteniendo compatibilidad cuando se necesiten saltos de linea explicitamente).
- Mapear severidad a un set canonico (`debug|info|warning|error|critical`) y opcionalmente guardar `severityNumber`.

#### 49) Desalineacion documental del contrato de logs (PRD legacy vs implementacion actual)

Evidencia:

- PRD describe `POST /api/device/logs` como body simple `{ device_token, level, message }` (`PRD.md:494`)
- Implementacion real usa batch `{ device_token, logs: [...] }` (`web/app/api/device/logs/route.ts`)
- PRD simplifica `DeviceLog` a `level/message/createdAt`, pero schema real incluye `event`, `sessionId`, `data` e indices (`PRD.md:668`, `web/prisma/schema.prisma:84`, `web/prisma/schema.prisma:96`-`98`)

Impacto:

- QA/operacion pueden usar payloads/expectativas viejas y diagnosticar falsos errores.
- Dificulta evolucion del sistema al no haber un contrato canonico actualizado para logs.

Cambio recomendado:

- Actualizar PRD y/o mover el contrato de logs al contexto canonico (`PROJECT.md`) con payload batch, enum de eventos, limites, retencion y filtros soportados.

### Recomendaciones priorizadas (logs) para produccion

1. Eliminar/redactar logs sensibles (pairing code, tokens, respuestas completas con URLs tokenizadas).
2. Corregir el pipeline del logger del player: cola acotada + estrategia de backpressure + no backlog pre-pairing + cierre ordenado.
3. Alinear seguridad de `/api/device/logs` con otros endpoints de device (`user.isActive`).
4. Separar `eventAt` vs `ingestedAt/observedAt` y dejar de confiar ciegamente en `createdAt` cliente.
5. Reducir superficie de pérdida por version skew (no rechazar batch completo por un evento desconocido).
6. Definir limites de volumen y tamaño (`rate`, `batch`, bytes, `data`) + retencion/capacidad reales.
7. Documentar contrato canonico de logs (payload, enum, severidad, retencion, filtros, errores).

### Comentario de diseño (logs) - estado actual vs objetivo

La base del diseño es buena (batching, eventos Sync estructurados, owner-only read, indices por device/sesion/evento), pero hoy tiene una combinacion peligrosa de:

- riesgo de fuga de secretos en mensajes
- confiar timestamps del cliente como `createdAt`
- cola local no acotada + drops silenciosos
- rechazo de batch completo por incompatibilidad de enum

Eso puede afectar tanto seguridad como observabilidad real en produccion (justo cuando mas se necesitan logs).

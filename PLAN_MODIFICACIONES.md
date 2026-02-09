# Plan de Modificaciones (Detallado)

Este plan detalla exactamente que se debe hacer, con pasos claros y checkpoints de verificacion en cada etapa.

**Paso 1 - Preparacion y verificacion inicial**
1. Ejecutar `git status` y registrar cualquier cambio previo.
2. Confirmar que el branch objetivo es `master`.
3. Confirmar la URL productiva de Vercel que debe usar el dashboard y el player.
Checkpoint: `git status` limpio o con cambios entendidos, y URL productiva confirmada.

**Paso 2 - Eliminar secretos hardcodeados y rotar credenciales**
1. Eliminar credenciales hardcodeadas en `web/check_device.ts` (usar variables de entorno o eliminar el script si no es necesario).
2. Ejecutar busqueda con `rg "postgresql://|npg_|BLOB_READ_WRITE_TOKEN|NEXTAUTH_SECRET"` para detectar secretos en el codigo.
3. Rotar credenciales expuestas en Neon y actualizar variables de entorno en Vercel.
Checkpoint: la busqueda no muestra secretos en el codigo, y Vercel tiene credenciales nuevas.

**Paso 3 - Cerrar endpoints de debug en produccion**
1. Proteger `web/app/api/debug-env/route.ts` con auth admin o bloquear en `NODE_ENV=production`.
2. Proteger `web/app/api/debug/playlist/[id]/route.ts` con auth admin o bloquear en `NODE_ENV=production`.
3. Remover stack traces en respuestas publicas (ej. `web/app/api/device/sync/route.ts`).
Checkpoint: endpoints de debug sin auth o en prod devuelven 401/404, y no hay stacks en respuestas publicas.

**Paso 4 - Corregir autorizaciones en mutaciones**
1. `DELETE /api/devices/[id]`: validar ownership antes de borrar.
2. `PUT /api/devices/[id]`: validar que `activePlaylistId`, `defaultPlaylistId` y `scheduleId` pertenezcan al usuario.
3. `PATCH /api/schedules/[scheduleId]`: validar ownership de cada `playlistId` incluido en items.
Checkpoint: pruebas con IDs de otro usuario devuelven 403; con IDs propios funcionan.

**Paso 5 - Validaciones de entrada consistentes**
1. Crear esquema Zod para `POST /api/media` y validar `type`, `url`, `duration`, `filename`, etc.
2. Validar en backend que schedules no tengan solapamientos, no solo en UI.
Checkpoint: inputs invalidos devuelven 400; inputs validos persisten correctamente.

**Paso 6 - Endurecimiento del player (Raspberry Pi)**
1. Reemplazar paths hardcodeados (`/home/masal/...`) por `os.path.expanduser("~")`.
2. Evaluar `--no-sandbox` en Chromium; si se mantiene, documentar riesgo y limitar uso.
3. Alinear `web/public/player.py` con `player/player.py` o eliminar el duplicado si no se usa.
Checkpoint: player arranca en Pi con usuario distinto y no falla por rutas.

**Paso 7 - Higiene de repo**
1. Actualizar `.gitignore` para `web/dev.db`, `web/prisma/dev.db`, `web/public/uploads/*`, `playwright-report`, `test-results`.
2. Si esos archivos estan versionados, removerlos con `git rm --cached` sin borrarlos localmente.
Checkpoint: `git status` muestra archivos ignorados correctamente y sin datos sensibles.

**Paso 8 - QA automatizado**
1. Ejecutar `python execution/run_tests.py unit`.
2. Ejecutar `python execution/run_tests.py e2e` si aplica.
3. Ejecutar `python execution/run_tests.py qa` si aplica.
Checkpoint: tests relevantes pasan o queda documentado lo que falla y por que.

**Paso 9 - Commit y push a GitHub**
1. Ejecutar `git add .`.
2. Ejecutar `git commit -m "fix: security, auth, player hardening"`.
3. Ejecutar `git push origin master`.
Checkpoint: `git status` limpio, push exitoso, Vercel inicia build.

**Paso 10 - Deploy a Raspberry Pi**
1. Asegurar que `player/config.json` apunte a la URL productiva de Vercel.
2. Ejecutar `\deploy.ps1 -PlayerIp <IP> -PlayerUser <USER>`.
3. Verificar servicio con `journalctl -u signage-player -f` o `systemctl status signage-player`.
Checkpoint: logs muestran sync exitoso, pairing OK y reproduccion estable.

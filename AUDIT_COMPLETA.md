# Auditoria Completa del Proyecto (DONE)

Fecha: 2026-02-11

Este documento resume la auditoria estatica completa del repo (excluyendo `node_modules/`, `playwright-report/` y `test-results/`). No se ejecutaron tests ni comandos remotos; es una revision de codigo, scripts y docs.

## Alcance Revisado
- Docs y directivas (raiz, `directives/`, `docs/`, `skills/`, `.agent/skills/`)
- Player (Python) y scripts de instalacion/deploy
- Web (Next.js), API, Prisma, auth, validaciones
- Configuracion y ejemplos de entorno

## Hallazgos Criticos

1) **Soporte de “Web Content” roto entre UI y backend**
- **Evidencia**:
  - UI envia `type: "web"` y `filename: null`.
    - `web/app/dashboard/media/media-manager.tsx`
  - Backend valida solo `image|video` y exige `filename`.
    - `web/lib/validations.ts`
    - `web/app/api/media/route.ts`
- **Impacto**: No se pueden guardar elementos web, aunque UI lo permite.
- **Correccion**:
  - Actualizar `CreateMediaItemSchema` para permitir `type: "web"` y `filename` nullable.
  - Ajustar `POST /api/media` para aceptar `web` (y no exigir `filename`).
  - Validar y persistir `cacheForOffline`, `orientation` si aplica.

2) **Instalador alternativo usa player desfasado**
- **Evidencia**:
  - `web/public/install.sh` descarga `player.py` y `sync.py` desde `web/public` (version distinta).
  - Archivos actuales en `player/` son mas nuevos.
- **Impacto**: Instalaciones con `install.sh` pueden quedar en version vieja.
- **Correccion**:
  - O bien eliminar `web/public/install.sh` como metodo oficial,
  - O actualizarlo para apuntar a `player/` real (o a release versionada).

3) **Canon duplicado y contradictorio**
- **Evidencia**:
  - Canon en `.agent/skills/project/*` y en `skills/project/*` con diferencias.
  - `directives/AGENTS.md` apunta a `.agent/skills/project/*`.
  - `canonical-context-manager` usa `skills/project/*`.
- **Impacto**: Agentes leen fuentes distintas y se desalinean.
- **Correccion**:
  - Elegir una unica fuente canonica.
  - Ajustar `directives/AGENTS.md` y/o `canonical-context-manager` a esa ruta.
  - Unificar contenido y borrar duplicados si aplica.

4) **Variables de entorno inconsistentes**
- **Evidencia**:
  - `schema.prisma` usa `DATABASE_URL_UNPOOLED`.
  - `web/.env.example` menciona `POSTGRES_*`.
- **Impacto**: Nuevos deploys pueden romper por vars incorrectas.
- **Correccion**:
  - Unificar en docs y `.env.example` con lo que usa Prisma.
  - Aclarar que `DATABASE_URL_UNPOOLED` no debe tener `-pooler`.

5) **Archivos sensibles y de entorno versionados**
- **Evidencia**:
  - Existen `.env`, `.env.local`, `player/config.json`, `current_config.json`, `temp_config.json`.
- **Impacto**: Riesgo de secretos expuestos / datos locales en repo.
- **Correccion**:
  - Asegurar `.gitignore` para `.env*`, `player/config.json`, `current_config.json`, `temp_config.json`.
  - Remover del historial si fue versionado.

## Hallazgos Medios

1) **OS recomendado inconsistente**
- `DEPLOY_INSTRUCTIONS.md`: Desktop requerido para video.
- `skills/project/DEPLOYMENT.md`: Lite recomendado.
- **Correccion**: definir OS oficial y ajustar docs.

2) **Pairing token: `""` vs `null`**
- `player/setup_device.sh` genera `device_token: ""`.
- Docs recomiendan `null`.
- **Correccion**: estandarizar en `null` o documentar que ambos disparan pairing.

## Hallazgos Menores

- Duplicacion de checkbox en `web/components/media/add-website-modal.tsx`.

## Estado de Deploy (Actualizado)
El deploy via `deploy.ps1` ahora es agnostico al usuario remoto:
- Resuelve el home remoto por SSH y usa `~/signage-player`.
- Verificacion de servicio activa.
Docs actualizados:
- `DEPLOY_INSTRUCTIONS.md`
- `player/INSTALL_INSTRUCTIONS.md`
- `player/README.md`
- `README.md`
- `directives/AGENTS.md`
- `skills/project/DEPLOYMENT.md`

## Propuesta de Plan de Correccion (Orden Sugerido)
1. Arreglar soporte “Web Content” (validaciones + API).
2. Unificar canon (definir una ruta canonica y corregir referencias).
3. Unificar variables de entorno (`DATABASE_URL_UNPOOLED`).
4. Resolver instalador alternativo (`web/public/install.sh`).
5. Limpiar archivos sensibles y ajustar `.gitignore`.
6. Corregir detalles menores (checkbox duplicado).

## Archivos Clave Referenciados
- Player: `player/player.py`, `player/sync.py`, `player/setup_device.sh`, `deploy.ps1`
- API: `web/app/api/device/*`, `web/app/api/media/route.ts`
- Validaciones: `web/lib/validations.ts`
- Prisma: `web/prisma/schema.prisma`
- Docs: `DEPLOY_INSTRUCTIONS.md`, `player/INSTALL_INSTRUCTIONS.md`, `skills/project/*.md`, `.agent/skills/project/*.md`


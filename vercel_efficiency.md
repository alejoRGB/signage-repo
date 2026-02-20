# Vercel Efficiency Plan (Validado)
_Actualizado: 2026-02-20_

---

## 1) Fuentes y Alcance

Este diagnóstico se armó con:
- Métricas del panel de usage que compartiste (captura).
- Revisión de código real del repo (`web/` y `player/`).
- Verificación vía Vercel API/CLI autenticada.

### Verificación por API (hechos)
- Usuario autenticado: `alejorgb`.
- Proyecto activo: `signage-repo-dc5s` (`rootDirectory: web`).
- Team: `alejos-projects-7a73f1be`.
- Plan del team: `hobby`.
- Runtime: `fluid: true`, región por defecto `iad1`.

### Limitación importante de API
- El endpoint de uso granular `/v1/usage` responde:
  `This API endpoint is only available to Teams on the Pro or Enterprise plan.`
- Por lo tanto, en plan Hobby no se puede extraer por API el desglose temporal por producto como el dashboard.

---

## 2) Snapshot de Riesgo (según captura)

| Recurso | Uso | Límite | % |
|---|---:|---:|---:|
| Blob Data Transfer | 8.79 GB | 10 GB | 87% |
| Fluid Active CPU | 2h 53m | 4h | 72% |
| Function Invocations | 591K | 1M | 59% |
| Edge Requests | 516K | 1M | 51% |
| Fluid Provisioned Memory | 163.1 GB-Hrs | 360 GB-Hrs | 45% |
| Blob Advanced Ops | 1K | 2K | 50% |

Riesgo inmediato: `Blob Data Transfer` y `Fluid Active CPU`.

---

## 3) Diagnóstico Técnico Profundo (código real)

## 3.1 Presión de invocaciones: patrón de polling actual

### Device command polling (muy alto impacto)
- `player/videowall_controller.py`: `poll_interval_s = 1.0`.
- Se ejecuta siempre en el loop principal (`player/player.py`, `loop_sleep_s = 0.2` + `tick()`).
- Resultado: `GET /api/device/commands` ~60 req/min por dispositivo, incluso sin sesión sync activa.

### Heartbeats
- `player/player.py`: `preview_report_loop` cada 5s -> `POST /api/device/heartbeat` (~12 req/min/device).
- En sesiones Sync activas: `player/videowall_controller.py` reporta runtime cada 2s (`status_interval_s = 2.0`) -> +30 req/min/device.

### Sync polling
- `player/sync.py`: `POST /api/device/sync` aproximadamente cada 60s.

### Modelo de carga estimado (por dispositivo)
- Modo normal (sin sesión Sync activa): `60 + 12 + 1 = 73 req/min`.
- Modo Sync activo: `60 + 12 + 30 + 1 = 103 req/min`.

### Escala estimada por flota (potencial teórico)
- 10 dispositivos en modo normal: `~1,051,200 req/día`.
- 20 dispositivos en modo normal: `~2,102,400 req/día`.
- 20 dispositivos en Sync activo: `~2,966,400 req/día`.

Esto explica bien la presión en `Function Invocations` y también parte de `Fluid Active CPU`.

---

## 3.2 Presión de CPU en rutas calientes

### `/api/device/heartbeat`
- Siempre hace `device.update`.
- Si llega `sync_session_id`, también ejecuta:
  - `persistDeviceSyncRuntime(...)`
  - `maybeReelectMasterForSession(...)`
- En Sync activo (cada 2s por device), la reelección de master se evalúa demasiado seguido.

### `/api/device/sync`
- Ruta `force-dynamic`.
- Query con includes profundos en cada poll:
  - schedule/items/playlist/items/mediaItem
  - defaultPlaylist/items/mediaItem
  - activePlaylist/items/mediaItem

### `/api/devices`
- Hace 2 queries por request (`device.findMany` + `mediaItem.findMany`) y se consulta por polling desde UI.

---

## 3.3 Blob Transfer: ajuste de hipótesis

Hecho clave:
- El player actual envía heartbeat con `preview_path=None` en su loop principal.
- El dashboard de device cards usa preview derivada de `MediaItem.url` (no screenshots de device).

Conclusión:
- El upload de preview no parece hoy la causa principal de invocaciones/CPU.
- Puede contribuir a `Blob Data Transfer` si hay clientes legacy u otros flujos usando preview upload.
- Aun así, endurecer esta parte sigue siendo válido como defensa de costos.

---

## 4) Plan de Optimización Priorizado

## P0 — Cambios rápidos (mismo día, alto impacto)

1. **Polling adaptativo de `/api/device/commands`**
- Si no hay sesión Sync activa: subir de `1s` a `10s`.
- En estados críticos (WARMING_UP/STARTING): mantener `1s`.
- En PLAYING estable: `2-3s`.
- Impacto esperado: reducción fuerte de invocaciones y CPU (hasta ~80-90% en tiempo idle).

2. **Bajar frecuencia de polling de dashboard**
- `web/components/dashboard/device-preview-grid.tsx`: `5s -> 20s`.
- `web/app/dashboard/devices/device-manager.tsx`: `10s -> 30s`.
- Impacto esperado: caída directa de `GET /api/devices`.

3. **Throttle de reelección de master**
- Evitar `maybeReelectMasterForSession` en cada heartbeat con runtime.
- Ejecutar cada `10s` por sesión o por evento de riesgo (`DISCONNECTED/ERRORED`).
- Impacto esperado: menos queries/transacciones pesadas en momentos de alta actividad.

4. **Reducir frecuencia de runtime heartbeat en PLAYING**
- Mantener 2s durante warm-up.
- Cambiar a 5s en PLAYING estable.
- Impacto esperado: menos escrituras de `SyncSessionDevice` sin perder visibilidad operativa útil.

## P1 — Corto plazo (1-3 días, impacto alto sostenido)

5. **Versionado real de config para `/api/device/sync`**
- No usar `Device.updatedAt` como ETag (cambia por heartbeats).
- Crear versión estable de “asignación de reproducción” (por ejemplo `syncConfigVersion`).
- Si versión no cambió, responder `304` y evitar include profundo.

6. **Optimizar `/api/devices`**
- Evitar reconstruir mapa completo de `mediaItems` en cada poll.
- Opciones:
  - cache por usuario con TTL corto en servidor;
  - materializar `currentMediaItemId` para lookup directo.

## P2 — Mediano plazo (3-7 días, impacto en Blob y simplificación)

7. **Deprecar flujo de preview screenshot si no se usa**
- Confirmar en prod si `/api/device/preview` recibe tráfico real.
- Si no se usa: deprecación gradual y cleanup.
- Si se mantiene:
  - subir `cacheControlMaxAge` de 5s a 60s;
  - upload solo cuando cambia contenido.

8. **Limpieza de blobs huérfanos al borrar devices**
- Al `DELETE /api/devices/[id]`, borrar `device-previews/{id}/latest.jpg`.

---

## 5) Impacto Esperado (orden de magnitud)

Si se aplica P0 completo:
- `Function Invocations`: reducción relevante (normalmente 40-70% según tamaño de flota y horas activas).
- `Fluid Active CPU`: reducción clara por menor frecuencia de rutas pesadas.
- `Blob Data Transfer`: baja moderada; alta solo si todavía hay clientes subiendo previews con frecuencia.

---

## 6) Ejecución Recomendada (orden exacto)

1. Polling adaptativo de comandos.
2. Polling UI dashboard (5->20s y 10->30s).
3. Throttle de reelección de master.
4. Runtime heartbeat 2s->5s en PLAYING.
5. Versionado de `/api/device/sync` con `304`.
6. Optimización de `/api/devices`.
7. Deprecación/optimización de preview blob.

---

## 7) Validación y KPIs Post-cambio

Medir durante 24-48h tras P0:
- Function Invocations (objetivo: -40% o mejor).
- Fluid Active CPU (objetivo: bajar de zona >70% a <50%).
- Edge Requests (debe bajar por menor polling UI).
- Blob Data Transfer (objetivo: estabilizar por debajo de 70% del cupo mensual en curso).

Si P0 no alcanza:
- avanzar inmediatamente con P1 (versionado de sync y optimización `/api/devices`).

---

## 8) Nota Operativa

Para plan Hobby, la API de Vercel no expone uso granular por producto/tiempo como en Pro/Enterprise.
Por eso el plan está diseñado a partir de:
- patrón de tráfico real del código,
- límites observados en dashboard,
- y rutas con mayor costo computacional.

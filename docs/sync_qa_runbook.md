# Sync QA Runbook (Carga y Caos hasta 20 devices)

## 1. Objetivo
Validar en staging que el modulo Sync/VideoWall es operable sin soporte de desarrollo en:

- Carga progresiva: 2, 5, 10 y 20 devices.
- Recuperacion ante desconexion y rejoin.
- Failover automatico de master.
- Estabilidad bajo thermal stress.

Este runbook cubre SYNC-043 y asume que SYNC-042 ya esta disponible (`python execution/run_tests.py sync`).

## 2. Alcance y criterio de aprobacion
Una ejecucion se considera aprobada si:

- La sesion Sync inicia y termina desde UI sin inconsistencias.
- Los devices pasan por estados esperados (`assigned -> preloading -> ready -> warming_up -> playing`).
- Rejoin ocurre automaticamente despues de reconexion.
- Failover de master ocurre sin dejar sesion sin master.
- En carga estable, `p95 drift` se mantiene dentro de objetivo operativo.

Objetivo operativo de referencia:

- Target: `p95 drift <= 40ms`.
- Alerta: `p95 drift > 100ms`.
- Critico: `p95 drift > 300ms` o devices en `errored` persistente.

## 3. Prerrequisitos

### 3.1 Infraestructura
- Ambiente staging con backend accesible.
- 20 devices maximo en la misma LAN (mezcla real de hardware si aplica).
- Contenido video ya cargado y con `durationMs` valido.
- Preset Sync creado para cada escala (2/5/10/20).

### 3.2 Validaciones previas
1. Ejecutar suite Sync:
```powershell
python execution/run_tests.py sync
```
2. Verificar clock sync en cada device (ejemplo por SSH):
```bash
chronyc tracking
chronyc sources -v
```
3. Verificar servicio del player:
```powershell
python execution/player_ops.py remote_status -PlayerIp <IP> -PlayerUser <USER>
```

## 4. Datos a capturar (evidencia)
Para cada corrida guardar:

- ID de sesion.
- Cantidad de devices objetivo.
- Captura de pantalla del panel Sync al inicio, minuto 2 y fin.
- Estado por device (incluye master actual).
- `drift avg`, `drift max`, `health`, `resync count`, `resync rate`.
- Eventos de logs por device/sesion (`HARD_RESYNC`, `REJOIN`, `MPV_CRASH`, `THERMAL_THROTTLE`).
- Resultado final: PASS/FAIL + causa.

Consulta sugerida de logs (autenticado como user owner):

`GET /api/devices/<deviceId>/logs?sessionId=<sessionId>&event=HARD_RESYNC&limit=200`

## 5. Matriz de carga

| Escala | Devices | Duracion minima | Objetivo principal |
| --- | --- | --- | --- |
| L1 | 2 | 10 min | Baseline funcional y visual |
| L2 | 5 | 10 min | Confirmar estabilidad multi-device |
| L3 | 10 | 15 min | Validar deriva y salud bajo carga media |
| L4 | 20 | 20 min | Validar limite operativo y SLA de inicio |

## 6. Procedimiento base (aplica a 2/5/10/20)
1. En Dashboard abrir tab `Sync`.
2. Seleccionar preset de la escala a ejecutar.
3. Iniciar sesion (`Start`) y registrar timestamp.
4. Confirmar readiness de todos los devices antes del timeout.
5. Verificar transicion a `playing` en todos los devices.
6. Monitorear panel de salud durante la duracion definida.
7. Detener sesion (`Stop`) y registrar timestamp.
8. Guardar evidencia y completar tabla de resultados.

## 7. Escenarios de caos

### 7.1 Desconexion y rejoin (obligatorio)
Objetivo: validar `disconnected -> warming_up -> playing` sin intervencion manual.

Pasos:
1. Con sesion activa en escala >= 5, elegir 1 device.
2. Cortar conectividad en el device (ejemplo):
```bash
sudo ip link set <iface> down
sleep 8
sudo ip link set <iface> up
```
3. Verificar en UI que el device pasa a `disconnected`.
4. Verificar rejoin automatico en <= 10s desde reconexion.
5. Confirmar que vuelve a `playing` y registra evento `REJOIN`.

Criterio de aprobacion:
- PASS si hay rejoin automatico y recupera estado `playing`.
- FAIL si requiere reinicio manual del player o queda fuera de sesion.

### 7.2 Caida de master y failover (obligatorio)
Objetivo: validar reeleccion de master sin interrumpir sesion.

Pasos:
1. Identificar `masterDeviceId` en UI (panel Sync).
2. Forzar caida del player master:
```powershell
python execution/player_ops.py remote_stop -PlayerIp <MASTER_IP> -PlayerUser <USER>
```
3. Esperar ventana de heartbeat (`~5s`) y observar nuevo master en UI.
4. Verificar que los otros devices permanecen en sesion.
5. Reiniciar player en device afectado:
```powershell
python execution/player_ops.py remote_start -PlayerIp <MASTER_IP> -PlayerUser <USER>
```
6. Verificar rejoin del device reiniciado.

Criterio de aprobacion:
- PASS si hay master nuevo y la sesion sigue activa.
- FAIL si la sesion queda sin master o aborta sin causa operativa valida.

### 7.3 Thermal stress (obligatorio)
Objetivo: validar deteccion de throttling y degradacion controlada.

Pasos:
1. En 1-2 devices ejecutar carga:
```bash
stress --cpu 4 --io 2 --timeout 180
```
2. Monitorear en UI:
- `throttled`/salud degradada.
- aumento controlado de `resync count`.
3. Revisar logs por eventos `THERMAL_THROTTLE` y `HARD_RESYNC`.
4. Esperar fin del stress y verificar recuperacion de salud.

Criterio de aprobacion:
- PASS si el sistema detecta throttling y mantiene reproduccion.
- FAIL si multiples devices caen a `errored` sostenido o no recuperan.

## 8. Criterios de salida de SYNC-043

- Ejecutadas corridas completas en 2/5/10/20 devices.
- Ejecutados escenarios: desconexion/rejoin, caida de master, thermal stress.
- Evidencia almacenada para cada corrida.
- Resultado consolidado disponible para go/no-go de rollout.

## 9. Plantilla de reporte (copiar por corrida)

| Campo | Valor |
| --- | --- |
| Fecha |  |
| Ambiente | staging |
| Escala | 2 / 5 / 10 / 20 |
| Session ID |  |
| Preset ID |  |
| Start time |  |
| Stop time |  |
| p95 drift observado |  |
| max drift observado |  |
| total resyncs |  |
| devices with issues |  |
| Eventos relevantes |  |
| Resultado | PASS / FAIL |
| Notas |  |

## 10. Troubleshooting rapido

- Device no llega a `ready`:
  - `chronyc tracking`
  - validar media local/cache
  - revisar logs del player y backend
- Deriva alta sostenida:
  - revisar clock offset
  - revisar carga CPU/temperatura
  - revisar si hay `HARD_RESYNC` frecuente
- Desconexion recurrente:
  - validar red LAN y firewall
  - verificar heartbeat y rate limit

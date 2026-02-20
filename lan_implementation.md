# LAN Sync Implementation Plan
_Fecha: 2026-02-20_

---

## 1) Explicacion simple (sin tecnicismos)

Hoy los dispositivos se sincronizan "hablando" seguido con Vercel.  
Eso funciona, pero tiene dos costos:

1. Usa mas requests en la nube (mas consumo de capacidad).
2. La precision depende mas de internet que de la red local.

La idea nueva es esta:

- Vercel sigue siendo el "jefe" para iniciar/parar sesiones y guardar estado.
- Pero durante la reproduccion, los dispositivos se sincronizan entre ellos por red local (LAN).

### Como se veria en la practica

Imagina una orquesta:
- Vercel es quien dice "arranquen ahora con esta cancion".
- Un dispositivo "master" marca el pulso muchas veces por segundo en la red local.
- Los otros dispositivos (followers) se ajustan a ese pulso en tiempo real.

Con eso logramos:
- Mejor sync visual (menos drift visible).
- Menos trafico constante hacia Vercel.
- Menos uso de CPU/invocaciones en la nube.

---

## 2) Que se mantiene en Vercel y que pasa a LAN

### Se mantiene en Vercel (control plane)
- Crear sesion sync.
- Elegir master inicial.
- Enviar comandos de `SYNC_PREPARE` y `SYNC_STOP`.
- Guardar telemetria y estado para dashboard.
- Failover de master cuando haga falta.

### Pasa a red local LAN (data plane de sync fino)
- Senal de timing frecuente entre dispositivos (master -> followers).
- Correcciones finas de drift con mayor frecuencia que la nube.

---

## 3) Arquitectura recomendada

Se recomienda un modelo **hibrido**:

1. **Cloud control**: Vercel para orquestacion y observabilidad.
2. **LAN timing**: beacons UDP desde el master a los followers.
3. **Fallback automatico**: si falla LAN, volver temporalmente al modo actual basado en nube.

Por que UDP LAN:
- Muy liviano.
- Baja latencia.
- Facil de emitir en alta frecuencia (20-50 veces por segundo).

---

## 4) Flujo esperado (paso a paso)

1. Usuario inicia sesion desde dashboard.
2. Vercel crea sesion y envia `SYNC_PREPARE` a cada dispositivo.
3. Todos arrancan con el mismo `start_at_ms` (como hoy).
4. El master empieza a emitir beacons LAN de sincronizacion.
5. Followers usan esos beacons para micro-correcciones mas rapidas.
6. Heartbeats a Vercel bajan de frecuencia (telemetria resumida).
7. Si no hay beacons LAN por X segundos, follower entra en fallback cloud.
8. Si el master cae, Vercel reelige master y reconfigura la sesion.

---

## 5) Plan de implementacion por fases

## Fase P0 - Diseno y feature flags (sin riesgo de produccion)
- Definir protocolo de beacon LAN (campos, version, frecuencia).
- Agregar flags de entorno:
  - `SYNC_LAN_ENABLED`
  - `SYNC_LAN_BEACON_HZ`
  - `SYNC_LAN_TIMEOUT_MS`
  - `SYNC_LAN_FALLBACK_TO_CLOUD`
- Definir telemetria minima para saber si LAN esta activa.
- Salida de fase:
  - Documento de protocolo.
  - Flags integrados sin alterar comportamiento por defecto.

## Fase P1 - Emisor LAN en master
- Implementar emision UDP en el dispositivo master.
- Beacon sugerido (payload minimo):
  - `session_id`
  - `master_device_id`
  - `seq`
  - `sent_monotonic_ms`
  - `target_phase_ms`
  - `playback_speed`
- Frecuencia inicial sugerida: 20 Hz (cada 50 ms).
- Salida de fase:
  - Master emite en LAN cuando la sesion esta activa.
  - Logs locales confirman envio estable.

## Fase P2 - Receptor LAN en followers + correccion fina
- Followers escuchan beacons LAN del master.
- Usar beacon para ajustar drift fino mas seguido que hoy.
- Mantener reglas de seguridad:
  - Hard reset si drift supera umbral alto (ya definido).
  - Soft correction en drift menor.
- Salida de fase:
  - Followers convergen mas rapido.
  - Menor drift promedio en pruebas locales.

## Fase P3 - Fallback robusto y failover
- Si LAN se interrumpe (timeout), pasar a modo cloud automaticamente.
- Cuando vuelva LAN estable, reenganchar sin cortar reproduccion.
- Integrar con failover existente de master en backend.
- Salida de fase:
  - No se pierde reproduccion por fallas LAN puntuales.
  - Recuperacion automatica validada.

## Fase P4 - Reduccion de carga en Vercel
- Bajar frecuencias cloud cuando LAN esta saludable:
  - `device heartbeat`
  - `sync status runtime`
  - `device commands poll` en PLAYING estable
- Mantener mas frecuencia solo en estados criticos (start/warmup/error).
- Salida de fase:
  - Menos invocaciones y menor CPU en Vercel.
  - Dashboard sigue util con telemetria suficiente.

---

## 6) Objetivos medibles (KPIs)

Comparar antes/despues durante 7 dias:

1. Precision sync
- `avg drift` por dispositivo.
- porcentaje de tiempo con drift <= 50 ms.

2. Carga Vercel
- Function Invocations.
- Fluid Active CPU.
- Edge Requests.

3. Estabilidad
- cantidad de fallbacks LAN -> cloud.
- cantidad de failovers de master.
- sesiones completadas sin interrupciones.

---

## 7) Riesgos y mitigaciones

Riesgo: red Wi-Fi con jitter o perdida de paquetes.  
Mitigacion: UDP liviano + smoothing + fallback cloud automatico.

Riesgo: multicast bloqueado por router.  
Mitigacion: soportar unicast desde master a followers como plan B.

Riesgo: reloj local desalineado entre dispositivos.  
Mitigacion: mantener chrony obligatorio y chequeos de clock health.

Riesgo: complejidad operativa de rollout.  
Mitigacion: feature flags + canary (1 sitio / pocos devices primero).

---

## 8) Plan de rollout recomendado

1. Entorno de prueba local con 2-3 dispositivos.
2. Canary en un grupo chico real.
3. Monitoreo 48-72h con flags encendidos.
4. Ajuste de frecuencia beacon y timeouts.
5. Activacion progresiva al resto.

---

## 9) Decisiones iniciales recomendadas

- Transporte LAN: UDP.
- Frecuencia inicial: 20 Hz.
- Timeout LAN para fallback: 1500-2000 ms.
- Modo por defecto inicial: cloud + LAN desactivado (activar por flag).
- Mantener Vercel como unica fuente de verdad para estado de sesion.

---

## 10) Resultado esperado

Si se implementa este esquema hibrido:
- Mejor sincronizacion visual entre pantallas en la misma LAN.
- Menor dependencia de latencia internet para correccion fina.
- Menor consumo de recursos en Vercel al reducir polling/heartbeats frecuentes.


# Agente: Player

## Descripcion General
Este agente es responsable del codigo que corre en los dispositivos de reproduccion (Raspberry Pi). Su objetivo es asegurar reproduccion fluida, sincronizada y robusta de contenido multimedia y web.

## Alcance del Proyecto
- **Directorio Principal:** `/player`
- **Archivos Clave:** `player.py`, `sync.py`, `lan_sync.py`, `videowall_controller.py`, `setup_device.sh`, `config.json` (generado).
- **Entorno de Ejecucion:** Raspberry Pi OS Lite (64-bit).

## Tecnologias y Herramientas
- **Lenguaje:** Python 3.x
- **Reproductor Multimedia:** MPV (IPC/socket)
- **Navegador:** Chromium (kiosk para contenido web)
- **Politicas de navegador:** Managed policy para bloquear prompts/UI del navegador en modo kiosco (traduccion, permisos de camara/mic, geolocalizacion, notificaciones, popups)
- **Scripting:** Bash
- **Sistema:** Linux + systemd

## Responsabilidades
1. **Sincronizacion**
   - Consumir APIs del dashboard para playlists, comandos y heartbeat.
   - Descargar/cachear contenido para operacion offline.
   - Reportar estado del dispositivo y runtime sync.
2. **Reproduccion**
   - Orquestar imagenes, videos y paginas web.
   - Mantener loop MPV/Chromium y transiciones suaves.
   - Ejecutar runtime de Sync/VideoWall cuando aplica.
3. **Mantenimiento**
   - Logs, resiliencia y diagnostico en dispositivos.
   - Compatibilidad con setup/deploy en Raspberry.

## Reglas y Limites
- **Testing:**
  - `python -m pytest player/tests` (instalando `player/requirements-test.txt`)
  - validacion manual del player en entorno controlado cuando sea necesario
- **Deploy:**
  - Verificar que cambios sean desplegables con `deploy.ps1` / `execution/player_ops.py`.
  - Tener en cuenta que los scripts actuales pueden requerir prompts si no se pasan parametros o no hay SSH preconfigurado.
  - Si `signage-player` queda `inactive/failed`, revisar `journalctl -u signage-player` antes de asumir un problema de display o red.
  - Para cambios de Chromium/kiosk web, preservar el hardening anti-prompts en `player.py` (flags + prefs) y en scripts de deploy/install (managed policy).

## Flujo de Trabajo Tipico
1. El coordinador solicita una mejora del player.
2. Este agente modifica codigo en `player/`.
3. Ejecuta tests relevantes (unitarios/sync) y validacion basica.
4. Si aplica, despliega a Raspberry y confirma estado del servicio.
5. Reporta resultado tecnico y riesgos pendientes.

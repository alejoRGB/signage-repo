# Guía de Instalación para Raspberry Pi - Digital Signage Player

Este documento detalla los pasos para configurar una nueva Raspberry Pi desde cero para que funcione como reproductor de cartelería digital.

## 1. Preparación del Hardware y OS

1.  **Descargar Raspberry Pi Imager**: [Web Oficial](https://www.raspberrypi.com/software/).
2.  **Seleccionar OS**:
    *   Recomendado: **Raspberry Pi OS (Legacy, 64-bit) Desktop**.
    *   *Nota: La versión "Legacy" suele ser más estable con X11/PCManFM que Wayland.*
3.  **Configuración Avanzada (Engranaje en Imager)**:
    *   **Hostname**: `signage-player-01` (o un nombre único).
    *   **Usuario**: `pi` (o tu usuario preferido).
    *   **SSH**: Habilitar SSH (Password auth).
    *   **WiFi**: Configurar SSID y Password (si no usas Ethernet).
4.  **Grabar y Bootear**: Insertar la SD en la Pi y encender.

## 2. Instalación del Software

### 2.1 Método recomendado (deploy desde otra PC con `deploy.ps1`)

> **Antes de desplegar desde tu PC:** desde la raíz del repo, ejecutá una vez:
> ```powershell
> .\setup_env.ps1
> ```
> Esto creará `web/.env` y `player/config.json` a partir de sus archivos de ejemplo **solo si no existen**. Ambos archivos contienen configuración/secrets locales y están ignorados por git.

1.  Conectá la Pi a internet y verificá que SSH esté habilitado.
2.  Conectate por SSH y actualizá el sistema:
    ```bash
    sudo apt update
    sudo apt upgrade -y
    ```
3.  Desde tu PC (en la raíz del repo), ejecutá:
    ```powershell
    .\deploy.ps1 -PlayerIp <PI_IP> -PlayerUser <USER>
    ```
    Este script:
    - Usa el home del usuario remoto (`~/signage-player`), sin hardcodear `/home/pi`.
    - Copia archivos, instala dependencias y deja el servicio activo.
4.  En la Pi, asegurate de que `config.json` tenga `device_token` en `null` para pairing. El archivo `~/signage-player/config.json` llega desde `player/config.json` de tu PC (generado por `setup_env.ps1`) y podés editarlo directamente en la Raspberry:
    ```bash
    nano ~/signage-player/config.json
    ```
5.  Reiniciá el servicio si hiciste cambios:
    ```bash
    sudo systemctl restart signage-player
    ```

### 2.2 Método alternativo (one‑line install)

Una vez que la Pi haya arrancado y esté conectada a internet (puedes verificarlo con `ping google.com`), abre una terminal (o conéctate por SSH) y ejecuta el siguiente **comando mágico**:

```bash
curl -sL https://raw.githubusercontent.com/alejoRGB/signage-repo/master/player/setup_device.sh | bash
```

**¿Qué hace este script?**
1.  Actualiza el sistema (`apt-get update`).
2.  Instala dependencias críticas: `mpv`, `chromium`, `git`, `python3-pip`, `feh`, `unclutter`.
3.  Descarga los archivos del reproductor **directamente** (sin git clone, para evitar errores).
4.  Instala las librerías de Python (`requests`, `socketio`, `Pillow`).
5.  Configura el "Stealth Mode" (Fondo negro, oculta íconos y cursor).
6.  Crea el servicio `systemd` para arranque automático.
7.  Inicializa la configuración en **Modo Pairing**.
8.  Instala y habilita **chrony** para sincronización de reloj.
9.  Ejecuta `chronyc tracking` al iniciar para diagnóstico de salud del reloj.
10. **Configuración de Zona Horaria (Arg)**: Se establece automáticamente a Buenos Aires.

### 2.3 Configuración de Zona Horaria

Para asegurar que los horarios de la cartelería funcionen correctamente, es recomendable establecer la zona horaria explícitamente si el script no lo hizo.

```bash
cd ~/signage-player
chmod +x setup_timezone.sh
./setup_timezone.sh America/Argentina/Buenos_Aires
```

## 3. Post-Instalación

Al finalizar el script, verás un mensaje de éxito. Reinicia la Pi:

```bash
sudo reboot
```

### Comportamiento Esperado
*   La Pi arrancará.
*   El escritorio se verá **negro** (sin fondo predeterminado).
*   No verás el cursor del mouse.
*   En unos segundos, aparecerá un **Código de Pairing** (QR o Texto) en pantalla completa.
    *   Requiere `device_token: null` en `~/signage-player/config.json` y `server_url` correcto.
*   En modo Sync/Videowall, el player solo entra en `READY` si la salud del reloj es correcta (`chronyc tracking`).

## 4. Vincular el Dispositivo
1.  Ve al **Dashboard Web** (PC o Móvil).
2.  Entra en la sección **Devices**.
3.  Haz clic en **"Pair Device"**.
4.  Introduce el código que ves en la pantalla de la TV/Monitor.

¡Listo! El dispositivo descargará su programación y comenzará a reproducir.

---

## Solución de Problemas

Si el código no aparece o la pantalla se queda en el escritorio de Raspberry Pi:

1.  **Verificar estado del servicio:**
    ```bash
    sudo systemctl status signage-player
    ```
2.  **Ver logs de error:**
    ```bash
    journalctl -u signage-player -n 50 --no-pager
    ```
3.  **Forzar reinicio del servicio:**
    ```bash
    sudo systemctl restart signage-player
    ```
4.  **Verificar sincronización de reloj (Sync/Videowall):**
    ```bash
    chronyc tracking
    ```

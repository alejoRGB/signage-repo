# Agente: Player

## Descripción General
Este agente es responsable de todo el código que se ejecuta en los dispositivos de reproducción (Raspberry Pi). Su objetivo es asegurar una reproducción fluida, sincronizada y robusta del contenido multimedia y web.

## Alcance del Proyecto
- **Directorio Principal:** `/player`
- **Archivos Clave:** `player.py`, `sync.py`, `install.sh`, `config.json` (generado).
- **Entorno de Ejecución:** Raspberry Pi OS Lite (64-bit).

## Tecnologías y Herramientas
- **Lenguaje:** Python 3.x
- **Reproductor Multimedia:** MPV (controlado vía IPC/socket).
- **Scripting:** Bash (para instalación y gestión de sistema).
- **Sistema Operativo:** Linux (Systemd para servicios).

## Responsabilidades
1.  **Sincronización:**
    -   Comunicarse con la API del Dashboard (`web-Back-End`) para obtener la lista de reproducción actual y configuraciones.
    -   Descargar y cachear contenido multimedia (imágenes, videos) localmente para soportar operación offline.
    -   Reportar el estado del dispositivo ("online", "offline", "playing") a la API.

2.  **Reproducción:**
    -   Orquestar la reproducción de imágenes, videos y páginas web.
    -   Manejar el ciclo de vida del proceso MPV.
    -   Asegurar transiciones suaves entre contenidos.
    -   Gestionar la duración de visualización de imágenes y webs.

3.  **Mantenimiento y Resiliencia:**
    -   Recuperación ante fallos (reinicio automático del script si falla).
    -   Actualización automática del código del player (si aplica).
    -   Gestión de logs locales.

## Reglas y Límites
-   **Testing:** Las pruebas son manuales. Debes verificar que el script corre sin errores: `python3 player.py`.
-   **Deploy:** Al no haber un deploy automático centralizado (cada Pi se actualiza), tu "deploy" consiste en verificar que los cambios subidos al repositorio sean descargables correctamente por `install.sh` o el mecanismo de update.

## Flujo de Trabajo Típico
1.  El `Coordinator` solicita una nueva funcionalidad (ej. "Soporte para mostrar PDFs").
2.  Este agente modifica `player/player.py` para manejar archivos PDF (quizás convirtiéndolos a imágenes o usando un visor).
3.  Prueba el cambio localmente ejecutando el script y simulando una playlist con PDF.
4.  Verifica que no rompa la reproducción de videos/imágenes.
5.  Reportar al `Coordinator` que la funcionalidad está lista y probada en el cliente.

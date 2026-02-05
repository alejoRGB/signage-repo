# Plan de Pruebas de Calidad (QA Plan)

**Proyecto:** Digital Signage Production  
**Target:** [https://senaldigital.xyz/](https://senaldigital.xyz/)  
**Fecha:** 2026-02-04  

## 1. Estrategia de Pruebas

Para garantizar la calidad en el entorno de producción sin afectar datos críticos, propongo una estrategia de **"Testeo por Módulos Incrementales"**.

En lugar de intentar probar todo de una sola vez, dividiremos los tests en fases lógicas. Esto nos permite identificar bloqueos tempranos (ej. si el login falla, no tiene sentido probar playlists).

### Herramienta Recomendada
- **Playwright** (Node.js o Python): Ideal para pruebas E2E modernas, manejo de autenticación persistente y captura de pantallas/video para evidencia.

---

## 2. Fases de Desarrollo del Test

### FASE 1: Core & Autenticación (Sanity Check)
*Objetivo: Verificar que el sistema es accesible y seguro.*
- **[AUTH-01]** Login exitoso con credenciales válidas.
- **[AUTH-02]** Login fallido con credenciales inválidas.
- **[AUTH-03]** Logout y destrucción de sesión.
- **[AUTH-04]** Redirección forzada al intentar acceder a /dashboard sin sesión.

### FASE 2: Gestión de Activos (Media & Playlists)
*Objetivo: Verificar las operaciones CRUD (Crear, Leer, Actualizar, Borrar) básicas.*
- **[MEDIA-01]** Subida de una imagen de prueba (.jpg/.png).
- **[MEDIA-02]** Validación de metadatos en la grilla (verificar que se muestra la resolución).
- **[MEDIA-03]** Creación de un ítem tipo página web.
- **[MEDIA-04]** Borrado de un ítem multimedia (Media/Web).
- **[PLAYLIST-01]** Creación de una Playlist tipo "Media".
- **[PLAYLIST-02]** Adición de ítems a la playlist y guardado.
- **[PLAYLIST-03]** Edición de duración de un ítem.

### FASE 3: Lógica de Negocio Compleja (Scheduling & Devices)
*Objetivo: Estresar las validaciones del sistema.*
- **[SCHED-01]** Creación de un horario (Schedule).
- **[SCHED-02]** Validación de solapamiento: Intentar crear dos reglas que se pisen en el mismo horario (debe fallar).
- **[DEV-01]** Edición de nombre de un dispositivo (si existe).
- **[DEV-02]** Asignación de Schedule a un dispositivo.

### FASE 4: Admin & Edge Cases (Opcional/Avanzado)
- **[ADMIN-01]** Creación de usuarios (requiere cuenta Admin).
- **[SYS-01]** Carga de archivos corruptos o formatos no soportados.

---

## 3. Requisitos Previos

Para ejecutar este plan, necesito que me proporciones (o que configuremos):

1.  **Usuario de Prueba:** Un email y password de un usuario "Standard" en producción. (NO usar una cuenta real con datos críticos si es posible, o autorizar el uso de una cuenta real sabiendo que crearemos datos de prueba).
2.  **Activos de Prueba:** Tengo capacidad de generar imágenes sintéticas, pero si tienes videos específicos, indícame.

## 4. Entregables

Por cada fase ejecutada, generaré un archivo `QA_RESULT_PHASE_X.md` conteniendo:
- Estado de cada test (PASS/FAIL).
- Tiempo de ejecución.
- Screenshots de errores (si la herramienta lo permite y se configura).
- Logs de consola del navegador si hay errores de JS.

---

## ¿Cómo procedemos?

Tengo dos modalidades para arrancar:
1.  **Modo Exploratorio Manual:** Navego yo mismo (vía browser tool) por la web para hacer un "reconocimiento" rápido inicial.
2.  **Modo Automatizado:** Empiezo a escribir el script de Playwright para la **FASE 1** inmediatamente.

**Recomendación:** Empecemos con la **FASE 1 (Auth)** en modo automatizado para asegurar que tenemos puerta de entrada.

# Agente: Web Front-End

## Descripcion General
Este agente se encarga de la interfaz visual y la experiencia de usuario del dashboard administrativo. Su objetivo es crear una interfaz intuitiva, rapida y estetica para gestionar dispositivos y contenidos.

## Alcance del Proyecto
- **Directorio Principal:** `/web` (excluyendo `/web/app/api` y `/web/prisma`).
- **Directorios Clave:** `/web/app` (paginas), `/web/components` (UI), `/web/app/globals.css`.

## Tecnologias y Stack
- **Framework:** Next.js 16.1.4 (App Router).
- **Lenguaje:** TypeScript.
- **Estilos:** Tailwind CSS v4.
- **Componentes:** React 19, Headless UI, Lucide React.
- **Data Fetching:** SWR.
- **Validacion:** Zod (formularios del cliente, cuando aplique).

## Responsabilidades
1. **Diseno UI/UX**
   - Mantener consistencia visual y accesibilidad.
   - Crear componentes reutilizables.
   - Implementar layouts responsive (mobile-first).
2. **Logica de Cliente**
   - Consumir APIs del backend web.
   - Gestionar formularios y estados de carga/error.
   - Integrar uploads y feedback visual al usuario.
3. **Integracion**
   - Mostrar correctamente datos de dispositivos, media, playlists y schedules.

## Reglas y Limites
- **Prohibido:** Modificar `web/app/api` o `web/prisma` sin coordinacion (derivar al rol backend).
- **Testing:**
  - `npm run test:ui` (componentes)
  - `npm run test:e2e` (smoke local; delega al hub `qa_automation`)
  - pruebas manuales de UI (navegacion, interacciones, responsive)
- **Deploy:** Verificar deploy en Vercel cuando el cambio tenga impacto web.

## Flujo de Trabajo Tipico
1. El coordinador solicita un cambio de UI.
2. Este agente modifica paginas/componentes en `web/app` y `web/components`.
3. Valida UX y estado responsive.
4. Ejecuta tests UI y smoke E2E local.
5. Confirma build web y reporta resultado.

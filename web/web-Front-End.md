# Agente: Web Front-End

## Descripción General
Este agente se encarga de la interfaz visual y la experiencia de usuario del Dashboard administrativo. Su objetivo es crear una interfaz intuitiva, ràpida y estética para gestionar los dispositivos y contenidos.

## Alcance del Proyecto
- **Directorio Principal:** `/web` (excluyendo `/web/app/api`, `/web/prisma`).
- **Directorios Clave:** `/web/app` (páginas), `/web/components` (UI), `/web/app/globals.css`.

## Tecnologías y Stack
- **Framework:** Next.js 16.1.4 (App Router).
- **Lenguaje:** TypeScript.
- **Estilos:** TailwindCSS v4.
- **Componentes:** React 19, HeadlessUI, Lucide React (iconos).
- **Data Fetching:** SWR (Stale-While-Revalidate).
- **Validación:** Zod (para formularios en cliente).

## Responsabilidades
1.  **Diseño UI/UX:**
    -   Mantener la consistencia visual (Tema oscuro/light, paleta de colores).
    -   Crear componentes reutilizables y accesibles.
    -   Implementar diseños responsivos (Mobile first/Desktop).

2.  **Gestión de Estado y Lógica de Cliente:**
    -   Consumir las APIs del `web-Back-End`.
    -   Gestionar formularios (Login, Registro, Edición de Playlists).
    -   Manejar la subida de archivos (interactuando con la API o Vercel Blob client-side si aplica).
    -   Feedback al usuario (Toasts, loaders, estados de error).

3.  **Integración:**
    -   Mostrar correctamente los datos provenientes de la base de datos (estado de dispositivos, listas de medios).

## Reglas y Límites
-   **Prohibido:** Modificar archivos en `web/app/api` o `web/prisma`. Si necesitas un cambio en el Backend, solicítalo al `Coordinator`.
-   **Testing:** Realizar pruebas manuales de la UI (navegación, clicks, responsive) antes de reportar tarea completada.
-   **Deploy:** Verificar en Vercel (o logs de build) que el cambio se ha desplegado correctamente.

## Flujo de Trabajo Típico
1.  El `Coordinator` solicita: "Añadir una página para ver logs de dispositivos".
2.  Este agente crea `web/app/dashboard/logs/page.tsx`.
3.  Diseña la tabla de logs usando Tailwind.
4.  Usa `useSWR` para obtener los datos desde `/api/devices/logs` (asumiendo que el Back-End ya creó el endpoint).
5.  Verifica visualmente que la tabla carga.
6.  Confirma que el build de Next.js pasa.
7.  Reporta finalización al Coordinator.

# Instrucciones para Ejecutar TestSprite

## Comando para el Chat de Antigravity

Copia y pega el siguiente mensaje en tu chat de Antigravity:

```
Can you test this project with TestSprite?

Application URL: https://signage-repo-dc5s-caucqcz9c-alejos-projects-7a73f1be.vercel.app/
PRD Document: C:\Users\masal\.gemini\antigravity\scratch\digital-signage\PRD.md

Please use the TestSprite MCP server to generate and execute automated tests based on the Product Requirements Document (PRD.md). The PRD contains comprehensive documentation of all features including:
- Authentication and user management
- Device pairing and management
- Media library (images, videos, web pages)
- Playlists (media and web types)
- Schedules (weekly time-based rules)
- Complete testing scenarios

Focus on frontend testing for the web dashboard. Use the test scenarios documented in section 13 of the PRD as a starting point.
```

## Información Adicional

**URL de la Aplicación:**
https://signage-repo-dc5s-caucqcz9c-alejos-projects-7a73f1be.vercel.app/

**Ubicación del PRD:**
`C:\Users\masal\.gemini\antigravity\scratch\digital-signage\PRD.md`

**Tipo de Testing:**
- Frontend (Web Dashboard)
- Aplicación Next.js con autenticación

**Credenciales de Prueba (si se requieren):**
*Nota: Es probable que TestSprite te pida credenciales para testear las rutas protegidas. Asegúrate de tener un usuario de prueba disponible.*

## Qué Esperar

1. Antigravity abrirá una página de configuración en el navegador
2. Deberás confirmar:
   - Tipo de testing: **Frontend**
   - Modo: **Codebase** (testing completo)
   - URL de la aplicación
   - Credenciales si son necesarias
3. TestSprite generará un plan de testing basado en el PRD
4. Podrás revisar y aprobar el plan antes de la ejecución
5. TestSprite ejecutará los tests y generará un reporte detallado

## Secciones del PRD Relevantes para Testing

El PRD incluye 67+ escenarios de testing en la **Sección 13: Testing Scenarios**, organizados por módulo:

- **13.1** Authentication
- **13.2** Device Management  
- **13.3** Media Library
- **13.4** Playlists
- **13.5** Schedules
- **13.6** Player Playback (requiere dispositivo Raspberry Pi)
- **13.7** Admin Functions

TestSprite debería enfocarse principalmente en las secciones 13.1-13.5 y 13.7 para testing web.

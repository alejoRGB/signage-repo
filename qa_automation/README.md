# QA Automation Suite

Este directorio contiene la suite de pruebas automatizadas para el proyecto Digital Signage.

## Estructura
- `tests/1_auth.spec.ts`: Pruebas de autenticación (Fase 1).
- `package.json`: Definición de dependencias.
- `playwright.config.ts`: Configuración global de Playwright.

## Instalación

1.  Abre una terminal en este directorio:
    ```powershell
    cd qa_automation
    ```
2.  Instala las dependencias:
    ```powershell
    npm install
    npx playwright install --with-deps
    ```

## Ejecución

Para correr las pruebas de la Fase 1:

```powershell
npx playwright test
```

Para ver el reporte visual (HTML):

```powershell
npx playwright show-report
```

## Credenciales
Las pruebas utilizan las credenciales hardcodeadas en `tests/1_auth.spec.ts`. Si cambian, actualízalas allí.

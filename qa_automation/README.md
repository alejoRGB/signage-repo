# QA Automation Suite

Este directorio contiene la suite de QA automatizada (Playwright) y referencias para validaciones manuales del modulo Sync.

## Estructura
- `tests/1_auth.spec.ts`: pruebas actuales de autenticacion.
- `tests/2_admin.spec.ts`: pruebas de autenticacion/autorizacion para `/admin`.
- `package.json`: dependencias y scripts de Playwright.
- `playwright.config.ts`: configuracion global de Playwright.
- `../docs/sync_qa_runbook.md`: runbook manual de carga y caos para Sync (2/5/10/20 devices).

## Instalacion
1. Abrir terminal en este directorio:
```powershell
cd qa_automation
```
2. Instalar dependencias:
```powershell
npm install
npx playwright install --with-deps
```

## Ejecucion

### QA E2E (Playwright)
```powershell
npx playwright test
```

Reporte HTML:
```powershell
npx playwright show-report
```

### Suite Sync (API + UI + player)
Desde la raiz del proyecto:
```powershell
python execution/run_tests.py sync
```

## Flujo recomendado para QA de Sync
1. Ejecutar `python execution/run_tests.py sync`.
2. Ejecutar pruebas manuales del runbook:
   - `docs/sync_qa_runbook.md`
3. Adjuntar evidencia y consolidar resultado PASS/FAIL por escala.

## Credenciales
Las pruebas Playwright usan variables de entorno (sin hardcodear secretos):

- Usuario dashboard:
  - `E2E_USERNAME`
  - `E2E_PASSWORD`
- Usuario admin:
  - `E2E_ADMIN_USERNAME` (o `E2E_ADMIN_EMAIL`)
  - `E2E_ADMIN_PASSWORD`

Si no se definen, las pruebas credentialed se marcan como `skipped`.

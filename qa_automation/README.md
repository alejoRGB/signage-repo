# QA Automation Suite

Este directorio contiene la suite de QA automatizada (Playwright) y referencias para validaciones manuales del modulo Sync.

## Estructura
- `tests/production/`: suite QA E2E contra entorno real (`/login`, `/admin`, Sync, failover).
- `tests/local/`: smoke tests E2E para validar la app local (`web`) con `npm run dev`.
- `tests/visual/`: capturas UI contra produccion (manual/soporte visual).
- `plans/testsprite/`: planes/artefactos de QA generados (no ejecutables).
- `package.json`: dependencias y scripts de Playwright.
- `playwright.config.ts`: config QA contra produccion (default).
- `playwright.local.config.ts`: config QA local con `webServer`.
- `playwright.visual.config.ts`: config visual/screenshot con timeout extendido.
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
npm test
```

### QA E2E local (arranca `web` automaticamente)
```powershell
npm run test:local
```

### Capturas visuales de produccion
```powershell
npm run test:visual
```

### Solo failover LAN (opt-in)
La prueba `SYNC-E2E-05` no corre por defecto. Debes habilitarla y definir comandos de stop/start por device master:

```powershell
$env:E2E_SYNC_FAILOVER_RUN="true"
$env:E2E_SYNC_STOP_CMD_RP4="plink -ssh -batch -hostkey ""ssh-ed25519 255 SHA256:..."" -pw 22 pi4@192.168.100.6 ""echo 22 | sudo -S systemctl stop signage-player"""
$env:E2E_SYNC_START_CMD_RP4="plink -ssh -batch -hostkey ""ssh-ed25519 255 SHA256:..."" -pw 22 pi4@192.168.100.6 ""echo 22 | sudo -S systemctl start signage-player"""
npx playwright test -c playwright.config.ts tests/production/4_sync_failover.spec.ts
```

Variables:
- `E2E_SYNC_FAILOVER_RUN`: habilita la prueba de caos (`true/1/yes`).
- `E2E_SYNC_STOP_CMD_<DEVICE_NAME>`: comando local para detener el player del master.
- `E2E_SYNC_START_CMD_<DEVICE_NAME>`: comando local para restaurar el player del master.

Notas:
- `<DEVICE_NAME>` se normaliza a mayusculas y `_` (ejemplo: `RP4` -> `E2E_SYNC_STOP_CMD_RP4`).
- Si faltan credenciales o comandos, la prueba se marca como `skipped`.

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

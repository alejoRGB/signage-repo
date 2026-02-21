# QA Automation Suite

Este directorio contiene la suite de QA automatizada (Playwright) y referencias para validaciones manuales del modulo Sync.

## Estructura
- `tests/1_auth.spec.ts`: pruebas actuales de autenticacion.
- `tests/2_admin.spec.ts`: pruebas de autenticacion/autorizacion para `/admin`.
- `tests/3_sync.spec.ts`: pruebas funcionales del wizard/panel Sync.
- `tests/4_sync_failover.spec.ts`: prueba de caos para failover LAN (opt-in).
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

### Solo failover LAN (opt-in)
La prueba `SYNC-E2E-05` no corre por defecto. Debes habilitarla y definir comandos de stop/start por device master:

```powershell
$env:E2E_SYNC_FAILOVER_RUN="true"
$env:E2E_SYNC_STOP_CMD_RP4="plink -ssh -batch -hostkey ""ssh-ed25519 255 SHA256:..."" -pw 22 pi4@192.168.100.6 ""echo 22 | sudo -S systemctl stop signage-player"""
$env:E2E_SYNC_START_CMD_RP4="plink -ssh -batch -hostkey ""ssh-ed25519 255 SHA256:..."" -pw 22 pi4@192.168.100.6 ""echo 22 | sudo -S systemctl start signage-player"""
npx playwright test tests/4_sync_failover.spec.ts
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

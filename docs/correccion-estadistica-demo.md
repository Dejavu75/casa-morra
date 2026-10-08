# Corrección estadística demo: una partida y seis vistas

La muestra ficticia permite verificar el circuito **corregir → publicar → actualizar → revertir** sin datos personales ni modificar el servicio local de entrega en `8088`. La publicación es deliberadamente manual: corregir el almacén no cambia la exportación que recibe el navegador.

## Prueba reproducible

Desde la raíz del repositorio, ejecutar `node --test test/stats-correction-flow.test.mjs`. La prueba crea rutas aisladas con identificadores aleatorios bajo `.demo-state/` y `.demo-public/`, usa las CLI reales, comprueba `verifyData` y compara los cálculos y el HTML de portada, torneo, anual, perfil, estadísticas y clásico antes/después de la corrección y tras revertirla. No necesita Docker y forma parte de `npm test`.

Para repetir el tramo HTTP y navegador, usar un checkout aislado y el puerto `8094`:

```powershell
New-Item -ItemType Directory -Force .demo-state,.demo-public | Out-Null
node scripts/demo-store.mjs init --store .demo-state/stats-e2e.json
node scripts/demo-public.mjs publish --store .demo-state/stats-e2e.json --output .demo-public/snapshot.json
$env:CASA_MORRA_HTTP_PORT='8094'
docker compose -p casa-morra-stats-e2e up -d --build
# Abrir http://127.0.0.1:8094/ y observar 6,5 puntos para Dante.
node scripts/demo-stats-scenario.mjs .demo-public/snapshot.json .demo-state/stats-correction.json .demo-state/stats-allowlist.json
$sha = (Get-Content .demo-state/stats-e2e.json -Raw | ConvertFrom-Json).snapshot.sha256
node scripts/demo-store.mjs correct --store .demo-state/stats-e2e.json --input .demo-state/stats-correction.json --expected-sha $sha --allowlist .demo-state/stats-allowlist.json
node scripts/demo-public.mjs status --store .demo-state/stats-e2e.json --output .demo-public/snapshot.json
# fresh:false; «Actualizar datos» todavía muestra 6,5 puntos.
node scripts/demo-public.mjs publish --store .demo-state/stats-e2e.json --output .demo-public/snapshot.json
# «Actualizar datos» muestra ahora 7 puntos.
node scripts/demo-store.mjs rollback --store .demo-state/stats-e2e.json
node scripts/demo-public.mjs publish --store .demo-state/stats-e2e.json --output .demo-public/snapshot.json
# Actualizar devuelve 6,5 puntos. Para cerrar solo esta copia: docker compose -p casa-morra-stats-e2e down
```

## Cifras esperadas

| Medida | Inicial | Corregida | Revertida |
|---|---:|---:|---:|
| `casa-2026-r1-p3` | tablas | 1–0 para Dante | tablas |
| Copa Casa Morra: Dante | 4 puntos, puesto 1 compartido | 4,5 puntos, puesto 1 | inicial |
| Copa Casa Morra: Celia | 2 puntos, puesto 3 compartido | 1,5 puntos, puesto 5 | inicial |
| Anual 2026–2027: Dante / Celia | 6,5 / 5,5 | 7 / 5 | inicial |
| Perfil de Dante: victorias | 9 | 10 | 9 |
| Récord de partidas ganadas: Dante | 9 | 10 | 9 |
| Clásico Celia–Dante: G–E–P | 1–2–2 | 1–1–3 | 1–2–2 |

La allowlist contiene **solo** `games/casa-2026-r1-p3` y `tournaments/casa-2026`. La tabla oficial se aporta completa junto con la partida; no se reconstruyen criterios de desempate ni jugadas. En la ejecución aislada de 2026-10-08, los SHA-256 canónicos fueron `f8238289ac5ea38ded4911f0667fae32cfa7ef1b87d37affbaf5ff2438488a24` → `58d770f8683f6db17fccc83c3e0bd80a8cea7556f023cc0c3cb0df2c7f8469be` → inicial. HTTP `/demo/snapshot.json` respondió `200`; el navegador mostró `6,5` antes de publicar incluso al pulsar «Actualizar datos», luego `7` y finalmente `6,5` tras revertir y republicar. Se recorrieron torneo, anual, perfil, estadísticas y clásicos en ese mismo contenedor.

Esta evidencia cubre **una** muestra reproducible. No constituye aceptación integral de `CC-03` o `CC-19`, no automatiza la publicación, no prueba recuperación ante desastre ni modifica el despliegue `8088`.

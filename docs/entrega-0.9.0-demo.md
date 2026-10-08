# Entrega local 0.9.0-demo y reversión

Este procedimiento entrega el **sitio de demostración ficticio** con exportación pública manual. No habilita cuentas ni importa datos del club de referencia. Cada etapa tiene una comprobación antes de avanzar; un contenedor saludable o HTTP 200, por sí solos, no prueban el funcionamiento de las estadísticas.

## 1. Preparar el candidato sin tocar 8088

Trabajar en un checkout limpio del commit candidato. Conservar el checkout anterior de `0.8.0-demo`, su imagen y el contenedor en `8088`. Desde la raíz del candidato, en PowerShell:

```powershell
npm test
npm run verify:data
docker compose config
node scripts/demo-store.mjs init --store .demo-state/casa-morra.json
node scripts/demo-public.mjs publish --store .demo-state/casa-morra.json --output .demo-public/snapshot.json
node scripts/demo-public.mjs status --store .demo-state/casa-morra.json --output .demo-public/snapshot.json
$env:CASA_MORRA_HTTP_PORT = '18089'
docker compose -p casa-morra-release-09 up --build -d
docker compose -p casa-morra-release-09 ps
Invoke-WebRequest http://127.0.0.1:18089/health
Invoke-WebRequest http://127.0.0.1:18089/demo/snapshot.json
```

`status` debe informar `exists:true` y `fresh:true`. Comprobar en el navegador `http://127.0.0.1:18089/` las rutas de inicio, torneo, anual, perfil, estadísticas, clásicos y partida; probar teclado, menú móvil, «Actualizar datos» y aviso de respaldo ante exportación ausente o inválida. La [prueba reversible de una corrección](correccion-estadistica-demo.md) verifica un caso `6,5 → 7 → 6,5`; no sustituye una conciliación integral.

La exportación es un bind mount de solo lectura **fuera** del docroot. No montar `.demo-state/` ni copiarlo a `dist/`. Docker excluye ambos directorios del contexto de construcción. La ruta `/demo/snapshot.json` expone únicamente datos ficticios; revisar su contenido antes de publicarla.

## 2. Registrar el punto de reversión

Antes de reemplazar el servicio, anotar el SHA del commit anterior, el ID/digest de la imagen que realmente ejecuta `8088`, el directorio y proyecto Compose de sus etiquetas, y el resultado de las comprobaciones en `18089`. No deducir la versión a partir del nombre del contenedor.

```powershell
$containers = @(docker ps --filter publish=8088 --format '{{.ID}}' | Where-Object { $_ })
if ($containers.Count -ne 1) { throw 'Se esperaba exactamente un contenedor en 8088' }
$previous = (docker inspect $containers[0] | ConvertFrom-Json)[0]
$previousCheckout = $previous.Config.Labels.'com.docker.compose.project.working_dir'
$previous.Config.Labels.'com.docker.compose.project'
$previousCheckout
$previous.Image
docker image tag $previous.Image casa-morra:rollback-0.8
docker image inspect casa-morra:rollback-0.8 --format '{{.Id}}'
```

En la instalación actual el proyecto habitual se llama `casa-morra`, pero confirmarlo con la etiqueta anterior antes de ejecutar los pasos siguientes. Guardar el directorio nuevo como `$candidateCheckout = (Get-Location).Path`; `$previousCheckout` ya proviene de la etiqueta. Ambos deben existir y contener su propio `compose.yaml`. No borrar el contenedor o checkout anterior ni sobrescribir su almacén. Si falta la imagen de reversión o la exportación nueva no está fresca, **no pasar a 8088**.

## 3. Cambiar el servicio local

Sólo después de aprobar el candidato aislado, cerrar la instancia de prueba y recrear el proyecto habitual con el Compose del candidato. `--no-build` utiliza la imagen candidata `casa-morra:local` ya construida en el paso 1; verificar su ID antes del cambio. Mantener el puerto ligado a `127.0.0.1`.

```powershell
docker compose -p casa-morra-release-09 down
Remove-Item Env:CASA_MORRA_HTTP_PORT
docker compose -p casa-morra -f "$candidateCheckout/compose.yaml" up --no-build --force-recreate -d
docker compose -p casa-morra -f "$candidateCheckout/compose.yaml" ps
Invoke-WebRequest http://127.0.0.1:8088/health
Invoke-WebRequest http://127.0.0.1:8088/demo/snapshot.json
```

Verificar de nuevo en `8088` navegación y cifras del navegador, que `/demo/snapshot.json` es `200`/`no-store`, que una ruta privada `.demo-state` es `404` y que no hay errores de consola. Comparar el ID de imagen del contenedor nuevo con el candidato, no sólo el estado `Up`. La publicación de un cambio posterior exige `publish` y «Actualizar datos»; si `status` da `fresh:false`, la vista sigue usando la exportación anterior.

### Reversión si falla la aceptación

La reversión del contenedor no modifica los archivos privados del candidato. Restaurar la etiqueta local al ID preservado y recrear desde el **Compose anterior**; no usar el Compose nuevo ni `--build` en la reversión. `$previousCheckout` se obtiene de la etiqueta `working_dir` registrada antes del cambio.

```powershell
docker image tag casa-morra:rollback-0.8 casa-morra:local
docker compose -p casa-morra -f "$previousCheckout/compose.yaml" up --no-build --force-recreate -d
docker compose -p casa-morra -f "$previousCheckout/compose.yaml" ps
Invoke-WebRequest http://127.0.0.1:8088/health
Invoke-WebRequest http://127.0.0.1:8088/
```

Comprobar por ID/digest que volvió la imagen `0.8.0-demo` y repetir una muestra funcional en el navegador. Si el proyecto/checkout anterior no coincide con lo registrado, detener la reversión automática y diagnosticar; no borrar datos para forzar el arranque.

## 4. Publicación y evidencia

Con el commit exacto y `8088` verificados, publicar `dhzacur/casa-morra:0.9.0-demo` y luego el alias `:demo`; comprobar los digest remotos de ambas etiquetas, no sólo el éxito de `docker push`. Confirmar CI de GitHub para el mismo SHA (pruebas, `verify:data` y construcción/ejecución Docker). Crear un prerelease `v0.9.0-demo` dirigido a ese commit y adjuntar un ZIP recuperable con manifiesto de rutas y SHA-256; incluir una copia identificada del ODD externo al repositorio. Registrar el SHA del ZIP y del ODD tal como se empaquetaron: el ODD vivo puede cambiar después. No subir `.demo-state/`, `.demo-public/`, credenciales ni datos reales al repositorio o al ZIP.

Actualizar el ODD y su espejo Engram con commit, CI, imagen/digest, prueba local, ZIP/manifest y límites de QA. Publicar código, imagen y prerelease son operaciones separadas; ninguna equivale a PR, merge, aceptación integral de las veinte tareas `CC` o disponibilidad de autenticación.

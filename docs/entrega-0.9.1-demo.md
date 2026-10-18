# Entrega `0.9.1-demo` y reversión local

Esta entrega incorpora las mejoras publicadas después de `0.9.0-demo` en la rama de Casa Morra: estado de la exportación, preparación para otros idiomas y reinicio del contenedor salvo parada manual. Usa exclusivamente datos ficticios. No incorpora la rama WebP pendiente de revisión, cuentas ni inscripción.

## Preparar y comprobar

Trabajar desde un checkout limpio del commit candidato. Conservar la imagen, el contenedor y el checkout de `0.9.0-demo` hasta terminar la aceptación. En PowerShell:

```powershell
git status --short
git rev-parse HEAD
node --test
npm run verify:data
docker compose config
node scripts/demo-store.mjs init --store .demo-state/casa-morra.json
node scripts/demo-public.mjs publish --store .demo-state/casa-morra.json --output .demo-public/snapshot.json
node scripts/demo-public.mjs status --store .demo-state/casa-morra.json --output .demo-public/snapshot.json
$env:CASA_MORRA_HTTP_PORT = '18098'
docker compose -p casa-morra-release-091 up --build -d
docker compose -p casa-morra-release-091 ps
Invoke-WebRequest http://127.0.0.1:18098/health
Invoke-WebRequest http://127.0.0.1:18098/demo/snapshot.json
```

El estado de la exportación debe indicar `exists:true` y `fresh:true`. Comprobar en navegador las quince clases de rutas públicas, diez tablas estadísticas, filtro de torneos, búsqueda de jugadores, visor de partida, problema y menú móvil. Registrar los casos omitidos y no equiparar `healthy` o HTTP 200 con aceptación funcional. La prueba de reinicio del motor/anfitrión es independiente: no reiniciar Docker Desktop solo para esta entrega si hay otros servicios activos.

## Preservar reversión antes de cambiar `8088`

Confirmar que exactamente un contenedor sirve `8088`. Registrar su ID de imagen, proyecto Compose, directorio y montaje de datos. Etiquetar **el ID de imagen que ejecuta**, no el alias `casa-morra:local`, que ya puede apuntar al candidato.

```powershell
$ids = @(docker ps --filter publish=8088 --format '{{.ID}}' | Where-Object { $_ })
if ($ids.Count -ne 1) { throw 'Se esperaba exactamente un contenedor en 8088' }
$anterior = (docker inspect $ids[0] | ConvertFrom-Json)[0]
$directorioAnterior = $anterior.Config.Labels.'com.docker.compose.project.working_dir'
$proyectoAnterior = $anterior.Config.Labels.'com.docker.compose.project'
$imagenAnterior = $anterior.Image
if ($proyectoAnterior -ne 'casa-morra' -or -not (Test-Path "$directorioAnterior/compose.yaml")) {
  throw 'El servicio anterior no coincide con el proyecto esperado'
}
docker image tag $imagenAnterior casa-morra:rollback-0.9
docker image inspect casa-morra:rollback-0.9 --format '{{.Id}}'
$idsAislados = @(docker compose -p casa-morra-release-091 ps -q web | Where-Object { $_ })
if ($idsAislados.Count -ne 1) { throw 'Se esperaba exactamente un contenedor aislado' }
$imagenCandidata = (docker inspect $idsAislados[0] | ConvertFrom-Json)[0].Image
$imagenCandidata
```

Anotar también el SHA-256 de `.demo-public/snapshot.json` del candidato y confirmar que el almacén privado `.demo-state/` no está montado. El snapshot público se monta solo para lectura fuera del docroot. No avanzar si falla cualquier comprobación o no se dispone de reversión.

## Cambiar el servicio local

Detener únicamente el proyecto aislado, no el servicio anterior. La imagen `casa-morra:local` construida arriba queda disponible para recrear el proyecto habitual. Usar el Compose del candidato desde su checkout; no ejecutar `--build` durante el cambio.

```powershell
$directorioCandidato = (Get-Location).Path
docker compose -p casa-morra-release-091 down
Remove-Item Env:CASA_MORRA_HTTP_PORT
docker compose -p casa-morra -f "$directorioCandidato/compose.yaml" up --no-build --force-recreate -d
docker compose -p casa-morra -f "$directorioCandidato/compose.yaml" ps
Invoke-WebRequest http://127.0.0.1:8088/health
Invoke-WebRequest http://127.0.0.1:8088/demo/snapshot.json
```

Comparar el ID de imagen de `8088` con `$imagenCandidata` y verificar `127.0.0.1:8088`, montaje público de solo lectura, `restart: unless-stopped` y `healthy`. Recorrer en navegador las rutas y las cifras principales, comprobar que la interfaz indica «Exportación pública verificada», que `/demo/snapshot.json` tiene `Cache-Control: no-store`, que `/demo/.demo-state` da 404 y que no aparecen errores en consola.

Si la aceptación falla, restaurar el alias local desde `casa-morra:rollback-0.9` y recrear con el **Compose del checkout anterior**, sin construir ni borrar datos:

```powershell
docker image tag casa-morra:rollback-0.9 casa-morra:local
docker compose -p casa-morra -f "$directorioAnterior/compose.yaml" up --no-build --force-recreate -d
docker compose -p casa-morra -f "$directorioAnterior/compose.yaml" ps
Invoke-WebRequest http://127.0.0.1:8088/health
Invoke-WebRequest http://127.0.0.1:8088/demo/snapshot.json
```

Volver a comprobar ID de imagen, snapshot y recorrido funcional. No alterar `dhzacur/casa-morra:demo` antes de aprobar la instancia local.

## Publicar sin sobrescribir evidencia histórica

Con CI verde del SHA exacto y `8088` aceptado, etiquetar y publicar `dhzacur/casa-morra:0.9.1-demo`; comprobar el digest remoto. Solo entonces actualizar el alias público `:demo` y comprobar que ambos digest coinciden. Mantener `:0.9.0-demo` como reversión pública. Crear el prerelease GitHub `v0.9.1-demo` dirigido al mismo commit y adjuntar un ZIP recuperable con manifiesto de rutas/hashes y copia identificada del ODD externo al repositorio. Excluir `.git/`, `.codegraph/`, `.demo-state/`, `.demo-public/`, credenciales y archivos de entorno.

Registrar en el ODD y su espejo el commit, CI, ID/digest de imagen, URL/digest de Docker Hub, ejecución de `8088`, ZIP/manifiesto, SHA-256 y límites de las pruebas. Publicar código, imagen y prerelease no implica PR, merge ni aceptación integral de `MVP-10` o `CC-20`.

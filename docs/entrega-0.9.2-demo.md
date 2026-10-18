# Entrega `0.9.2-demo` y reversión local

Esta candidata reúne las unidades posteriores a `0.9.1-demo`: estilo del botón «Actualizar datos», foco visible de controles nativos y precisión suficiente para distinguir valores Elo que ocupan puestos diferentes. Revalida recursos estáticos y cambia las URL de CSS y módulos modificados para que un navegador que ya visitó `8088` no reutilice la versión anterior. La aplicación sigue usando datos ficticios, sin cuentas ni inscripción. La rama WebP pendiente de consentimiento no está incluida.

## Comprobación previa

Trabajar desde el commit candidato limpio y conservar la imagen y el checkout de `0.9.1-demo` hasta validar la nueva instancia. En PowerShell:

```powershell
git status --short
git rev-parse HEAD
node --test
npm run verify:data
docker compose config
node scripts/demo-store.mjs init --store .demo-state/casa-morra.json
node scripts/demo-public.mjs publish --store .demo-state/casa-morra.json --output .demo-public/snapshot.json
node scripts/demo-public.mjs status --store .demo-state/casa-morra.json --output .demo-public/snapshot.json
$env:CASA_MORRA_HTTP_PORT = '18101'
docker compose -p casa-morra-release-092 up --build -d
docker compose -p casa-morra-release-092 ps
Invoke-WebRequest http://127.0.0.1:18101/health
Invoke-WebRequest http://127.0.0.1:18101/demo/snapshot.json
```

El estado de la exportación debe indicar `exists:true` y `fresh:true`. Recorrer en navegador las quince clases de rutas, diez tablas estadísticas, búsqueda de jugadores, filtro de torneos, visor, problema y menú móvil. En el récord de Elo, los puestos distintos no deben mostrar el mismo valor redondeado. Antes del cambio de `8088`, cargar la versión anterior en un navegador con caché normal; después del cambio, entrar a <http://127.0.0.1:8088/estadisticas?entrega=0.9.2-demo> **sin deshabilitar caché ni recargar forzosamente** y comprobar el Elo corregido. El parámetro hace nueva la URL del documento: una ruta antigua previamente cacheada todavía puede mostrar HTML y módulos viejos. Informar ese límite, no presentarlo como actualización automática de todas las pestañas. Registrar los casos omitidos: `healthy` y HTTP 200 no prueban funcionalidad completa ni accesibilidad con lector real.

## Preservar reversión antes de cambiar `8088`

Confirmar que exactamente un contenedor sirve `8088`. Registrar su ID de imagen, proyecto Compose, directorio y montaje público. Etiquetar **el ID de imagen en ejecución**, no `casa-morra:local`, que puede apuntar ya a la candidata:

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
docker image tag $imagenAnterior casa-morra:rollback-0.9.1
docker image inspect casa-morra:rollback-0.9.1 --format '{{.Id}}'
$idsAislados = @(docker compose -p casa-morra-release-092 ps -q web | Where-Object { $_ })
if ($idsAislados.Count -ne 1) { throw 'Se esperaba exactamente un contenedor aislado' }
$imagenCandidata = (docker inspect $idsAislados[0] | ConvertFrom-Json)[0].Image
$imagenCandidata
```

Anotar el SHA-256 de `.demo-public/snapshot.json` y confirmar que `.demo-state/` no está montado. La exportación pública se monta solo para lectura fuera del docroot. Si falla cualquiera de estas comprobaciones, no cambiar `8088`.

## Cambiar y comprobar la instancia local

Detener únicamente el proyecto aislado. La imagen `casa-morra:local` permanece disponible para recrear el proyecto habitual sin construir de nuevo:

```powershell
$directorioCandidato = (Get-Location).Path
docker compose -p casa-morra-release-092 down
Remove-Item Env:CASA_MORRA_HTTP_PORT
docker compose -p casa-morra -f "$directorioCandidato/compose.yaml" up --no-build --force-recreate -d
docker compose -p casa-morra -f "$directorioCandidato/compose.yaml" ps
Invoke-WebRequest http://127.0.0.1:8088/health
Invoke-WebRequest http://127.0.0.1:8088/demo/snapshot.json
```

Comparar el ID de imagen con `$imagenCandidata`; verificar enlace exclusivo `127.0.0.1:8088`, montaje público de solo lectura, `restart: unless-stopped`, `healthy`, snapshot con `Cache-Control: no-store` y rutas privadas con 404. Ingresar con `?entrega=0.9.2-demo` desde el navegador previamente cacheado; recorrer las vistas y comprobar «Exportación pública verificada», concordancia entre Elo y puestos y ausencia de errores de consola. No inferir que una pestaña vieja se reemplazó sola.

Si falla la aceptación, restaurar el alias local y recrear con **el Compose del checkout anterior**, sin construir ni borrar datos:

```powershell
docker image tag casa-morra:rollback-0.9.1 casa-morra:local
docker compose -p casa-morra -f "$directorioAnterior/compose.yaml" up --no-build --force-recreate -d
docker compose -p casa-morra -f "$directorioAnterior/compose.yaml" ps
Invoke-WebRequest http://127.0.0.1:8088/health
Invoke-WebRequest http://127.0.0.1:8088/demo/snapshot.json
```

Volver a comprobar imagen, snapshot y navegación. No actualizar el alias público `:demo` antes de aceptar la instancia local.

## Publicación identificable

Con CI exitosa del SHA exacto y `8088` comprobado, publicar `dhzacur/casa-morra:0.9.2-demo` y verificar su digest remoto. Solo después actualizar `dhzacur/casa-morra:demo` y comprobar igualdad de digest; conservar `:0.9.1-demo` como reversión pública. Crear prerelease GitHub `v0.9.2-demo` dirigida al mismo commit y adjuntar ZIP recuperable con manifiesto de rutas/hashes y copia identificada del ODD externo. Excluir `.git/`, `.codegraph/`, `.demo-state/`, `.demo-public/`, secretos y archivos de entorno.

Registrar commit, CI, ID local y digest remoto de la imagen, ejecución de `8088`, ZIP/manifiesto, SHA-256 y límites de las pruebas en el ODD y su espejo. Código, imagen y prerelease publicados no implican PR, merge ni aceptación integral de `MVP-10` o `CC-20`.

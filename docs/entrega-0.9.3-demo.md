# Entrega `0.9.3-demo`: comprobación y reversión

Esta entrega candidata reúne las correcciones y mejoras de las ramas 63 a 73: recursos XML ausentes con 404, accesibilidad móvil, grupos de rendimiento Elo previo por rival y favicon propio. **No incorpora las ramas 61 y 62**, cuyos consentimientos RDD específicos siguen pendientes. Sigue siendo una demostración pública con datos ficticios, sin cuentas ni inscripción. **Esta guía no acredita por sí sola que la candidata esté desplegada.**

## Antes de cambiar el servicio habitual

1. Confirmar el SHA exacto, checkout limpio, CI exitosa para ese SHA, `node --test`, `npm run verify:data` y `docker compose config`.
2. Verificar que `.demo-public/snapshot.json` existe y está fresco respecto de `.demo-state/casa-morra.json` mediante `node scripts/demo-public.mjs status --store .demo-state/casa-morra.json --output .demo-public/snapshot.json`. Si faltan, preparar únicamente los datos ficticios con `demo-store.mjs init` y `demo-public.mjs publish` antes de repetir `status`.
3. Exigir exactamente un contenedor en `127.0.0.1:8088`, proyecto Compose `casa-morra` y un checkout anterior que todavía contenga `compose.yaml`. Guardar su **ID de imagen en ejecución**, directorio, proyecto, hora de inicio, estado y hash del snapshot público. No usar `casa-morra:local` como identificación anterior: la construcción aislada cambia ese alias.
4. Etiquetar el ID de imagen anterior como `casa-morra:rollback-0.9.2` y verificar que ese alias apunta al mismo ID. Conservar el checkout y los datos anteriores.

Los pasos de inspección y reversión detallados se muestran en la [guía anterior](entrega-0.9.2-demo.md#preservar-reversión-antes-de-cambiar-8088). No ejecutar su etiqueta `rollback-0.9.1` para esta entrega; usar exclusivamente `rollback-0.9.2` sobre el **ID realmente observado**.

## Ensayo aislado

Desde el checkout candidato, con el puerto `18106` libre:

```powershell
$env:CASA_MORRA_HTTP_PORT = '18106'
docker compose -p casa-morra-release-093 up --build -d
docker compose -p casa-morra-release-093 ps
Invoke-WebRequest http://127.0.0.1:18106/health
Invoke-WebRequest http://127.0.0.1:18106/demo/snapshot.json
```

Registrar el ID de imagen candidata y comprobar: enlace solo a `127.0.0.1:18106`, contenedor `healthy`, montaje público de solo lectura fuera del docroot, `Cache-Control: no-store` en el snapshot y 404 para recursos XML inexistentes. La candidata todavía devuelve la página HTML con HTTP 200 para rutas como `/.git/config` y `/x/.private/file`; no atribuirle la protección pendiente de la rama 61. También conserva `/50x.html` de la imagen base; no atribuirle la retirada pendiente de la rama 62. Recorrer en navegador las vistas públicas, las diez tablas estadísticas, búsqueda/filtros, visor de partidas, problema, menú móvil, grupos Elo de seis perfiles, favicon SVG y foco de la tabla de «Clases». Ejecutar el test de cabeceras y compresión con `CASA_MORRA_TEST_URL=http://127.0.0.1:18106 node --test test/gzip-runtime.test.mjs`.

La URL nueva `?entrega=0.9.3-demo` solicita HTML fresco cuando un navegador había conservado una página anterior. Esta entrega versiona las entradas CSS/JS y las hojas de jugadores y contenido modificadas; los demás módulos dependen de la revalidación `Cache-Control: no-cache`. No afirmar que una pestaña antigua cambió automáticamente. Registrar cualquier prueba omitida, en particular lector de pantalla, contraste inconcluso o desplazamiento con flechas no verificado.

## Activación local y reversión

**Solo después del ensayo aprobado**, detener el proyecto aislado sin borrar su imagen, quitar la variable de puerto y recrear el proyecto habitual desde el checkout candidato:

```powershell
$directorioCandidato = (Get-Location).Path
docker compose -p casa-morra-release-093 down
Remove-Item Env:CASA_MORRA_HTTP_PORT
docker compose -p casa-morra -f "$directorioCandidato/compose.yaml" up --no-build --force-recreate -d
docker compose -p casa-morra -f "$directorioCandidato/compose.yaml" ps
```

Comparar el ID de imagen en `8088` con el candidato. Repetir `/health`, snapshot, rutas, cabeceras, navegador y estados principales con `?entrega=0.9.3-demo`. Si falla, volver al **checkout anterior observado** y a la imagen preservada, sin reconstruir ni borrar el almacén:

```powershell
docker image tag casa-morra:rollback-0.9.2 casa-morra:local
docker compose -p casa-morra -f "$directorioAnterior/compose.yaml" up --no-build --force-recreate -d
docker compose -p casa-morra -f "$directorioAnterior/compose.yaml" ps
```

Confirmar de nuevo ID de imagen, `healthy`, snapshot y navegación. Una reversión de contenedor no revierte automáticamente archivos de datos modificados; por eso no se modifican datos del servicio anterior durante el ensayo.

## Publicación identificable

Con CI del SHA exacto y `8088` aceptado, publicar `dhzacur/casa-morra:0.9.3-demo`, verificar el digest remoto y recién entonces actualizar `dhzacur/casa-morra:demo` al mismo digest. Mantener `:0.9.2-demo` como reversión pública. Crear la prerelease GitHub `v0.9.3-demo` dirigida al commit candidato y adjuntar un ZIP reproducible con manifiesto de archivos/hashes y copia identificada del ODD externo. Excluir `.git/`, `.codegraph/`, `.demo-state/`, `.demo-public/`, secretos y archivos de entorno.

Registrar SHA, CI, imagen local, digest remoto, estado de `8088`, ZIP y límites de verificación en el ODD y su espejo. Publicar imagen y prerelease no implica PR, merge ni cierre integral de `MVP-10` o `CC-20`.

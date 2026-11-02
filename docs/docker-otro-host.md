# Casa Morra en otro anfitrión Docker

Este procedimiento instala la web de estadísticas y el panel administrativo con datos demo. No usa Sites. Requiere Docker Compose compatible con `!override` (2.24.4 o posterior), Node.js 22 para la validación LAN y una IP concreta del anfitrión. El panel permanece en `127.0.0.1:8090`; el sitio público puede usar una IP LAN y el puerto 8088.

## Datos y preparación

La fuente de verdad es `.demo-state/admin.json`, incluida su auditoría. `.demo-public/snapshot.json` es una exportación derivada. Ambos directorios son locales, ignorados por Git y montados fuera de las imágenes. Nunca copies `.env` al repositorio ni a Docker Hub. El bootstrap solo crea datos ficticios cuando faltan ambos archivos; si ya existe el almacén, lo valida y solo crea la exportación ausente. Si hay una exportación huérfana, corrupta o distinta del almacén, falla sin reemplazarla.

En un anfitrión nuevo, clone la rama o versión elegida y cree los dos directorios vacíos. En PowerShell:

```powershell
New-Item -ItemType Directory -Force .demo-state, .demo-public | Out-Null
docker compose -p casa-morra -f compose.bootstrap.yaml run --build --rm prepare
```

En Linux, el usuario `node` de la imagen administrativa usa UID/GID 1000. Para directorios **nuevos**, asígnele la propiedad sin modificar datos preexistentes:

```sh
sudo install -d -m 0700 -o 1000 -g 1000 .demo-state
sudo install -d -m 0755 -o 1000 -g 1000 .demo-public
docker compose -p casa-morra -f compose.bootstrap.yaml run --build --rm prepare
```

El servicio de preparación no tiene red ni puertos y no requiere contraseña. Debe informar `{"created":true,"published":true}` la primera vez y `false` en ambas claves al repetirlo. Si el usuario del host ya es UID 1000 y posee los directorios, puede crearlos sin `sudo`. No cambie recursivamente la propiedad de una instalación existente sin verificar sus datos.

Para **trasladar** una instalación, detenga las escrituras administrativas, respalde y copie el archivo completo `.demo-state/admin.json` con su auditoría; no lo sustituya por el fixture. Copie también `.demo-public/snapshot.json` si corresponde al mismo almacén. Verifique hashes y permisos después de transferir, ejecute `prepare` y exija `created:false`. Si el snapshot falta, se genera a partir del almacén. Si es distinto o inválido, investigue antes de publicar; `prepare` no lo sobreescribe. La operación `restore` de la CLI está destinada a una línea de auditoría existente, no a iniciar una copia nueva en otro host.

## Configuración y arranque

Defina `CASA_MORRA_LAN_IP` con una dirección del nuevo anfitrión, nunca `0.0.0.0` ni `::`. El activador `scripts/compose-lan.mjs` verifica el modelo efectivo y rechaza comodines antes de ejecutar Compose. Elija una contraseña administrativa nueva y privada; no reutilice la del sitio de referencia. Puede suministrar las dos variables por el entorno o por un `.env` local ignorado por Git. Proteja ese archivo y tenga presente que Docker conserva las variables del contenedor en su configuración.

```powershell
$env:CASA_MORRA_LAN_IP = '192.168.0.52' # reemplazar
$segura = Read-Host 'Contraseña administrativa nueva' -AsSecureString
$env:CASA_MORRA_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $segura).Password
node scripts/compose-lan.mjs config
node scripts/compose-lan.mjs up -d --build web
docker compose -p casa-morra -f compose.admin.yaml up -d --build admin
Remove-Item Env:CASA_MORRA_ADMIN_PASSWORD
```

En Linux, exporte las dos variables sin guardarlas en el historial de comandos; luego ejecute los mismos comandos `node` y `docker compose`. El panel no se abre a la LAN por omisión. Su uso remoto requeriría una decisión de seguridad y otro despliegue; no cambie el bind administrativo para este procedimiento.

## Aceptación y reversión

Compruebe `docker compose -p casa-morra -f compose.yaml -f compose.lan.yaml ps web` y `docker compose -p casa-morra -f compose.admin.yaml ps admin`; ambos deben estar `healthy`. Pruebe `/health`, `/estadisticas` y `/demo/snapshot.json` desde la IP LAN, y el panel en `http://127.0.0.1:8090/` **desde el anfitrión**. Confirme visualmente estadísticas, inicio de sesión, creación de resultado y completado de jugadas manuales/PGN sin duplicar tablas. Un HTTP 200 o una prueba desde el propio host no demuestra conectividad desde otro equipo: para eso pruebe desde otro dispositivo de la LAN. No abra el router ni publique el panel en Internet; este montaje usa HTTP sin TLS.

Para volver la web al acceso local, ejecute `docker compose -p casa-morra -f compose.yaml up -d --no-build web` y verifique `127.0.0.1:8088/health`. El almacén y el snapshot están fuera de la imagen y no se borran al recrear el contenedor. Ante un traslado fallido, conserve los archivos originales y los hashes para diagnosticar antes de reintentar.

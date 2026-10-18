# Acceso a Casa Morra desde la red local

La variante `compose.lan.yaml` usa la red bridge de Docker y publica el puerto únicamente en `192.168.0.52:8088`. `compose.yaml` permanece ligado a `127.0.0.1:8088` para uso local y reversión. La variante LAN requiere Docker Compose 2.24.4 o posterior por el uso de `!override`.

## Antes de activar

1. Confirmar que `192.168.0.52` sigue asignada a este equipo, que el puerto `8088` está libre en esa dirección y que `.demo-public/snapshot.json` contiene solo datos ficticios. No montar `.demo-state/`.
2. Revisar el modelo combinado y exigir un único mapeo `192.168.0.52:8088→8088`, sin `127.0.0.1`, `0.0.0.0` ni `::` adicionales:

```powershell
docker compose -p casa-morra -f compose.yaml -f compose.lan.yaml config
```

3. Recordar que el sitio usa HTTP sin TLS ni autenticación. No abrir el router ni anunciar acceso desde Internet. El firewall del anfitrión y las reglas de la red pueden impedir el acceso desde otros equipos aunque la publicación local funcione.

## Activación y comprobación

Desde este checkout, con la exportación pública validada:

```powershell
docker compose -p casa-morra -f compose.yaml -f compose.lan.yaml up -d --build
docker inspect casa-morra-web-1 --format '{{.HostConfig.NetworkMode}} {{json .HostConfig.PortBindings}} {{.State.Health.Status}}'
Invoke-WebRequest http://192.168.0.52:8088/health
```

Confirmar una red bridge, estado `healthy` y una sola publicación con `HostIp=192.168.0.52` y `HostPort=8088`. Probar también portada, una ruta profunda, un activo y `/demo/snapshot.json`. Una solicitud hecha en el propio anfitrión a `192.168.0.52` **no** demuestra acceso desde otro dispositivo; esa aceptación requiere una prueba desde un equipo distinto de la LAN.

## Reversión

```powershell
docker compose -p casa-morra -f compose.yaml up -d --no-build
Invoke-WebRequest http://127.0.0.1:8088/health
```

Confirmar después que la única publicación sea `127.0.0.1:8088` y que el contenedor permanezca `healthy`. No reiniciar Docker Desktop ni modificar otros proyectos para alternar estas dos variantes.

Referencia: [reglas de combinación de Docker Compose](https://docs.docker.com/reference/compose-file/merge/).

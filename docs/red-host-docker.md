# Red del host en Docker Desktop

Casa Morra puede servir HTTP en la red local mediante `http://192.168.0.52:8088/`. Esta es una dirección privada del anfitrión; no se abre el router ni se publica el servicio en Internet. La variante habitual de `compose.yaml` conserva la publicación exclusiva en `127.0.0.1:8088` y sirve como reversión.

## Preparación

1. Comprobar que `192.168.0.52` pertenece a una interfaz de este equipo, que el puerto `8088` no está ocupado por otro servicio y que `.demo-public/snapshot.json` contiene únicamente datos ficticios. No montar `.demo-state/`.
2. En Docker Desktop 4.34 o posterior para contenedores Linux, habilitar **Settings → Resources → Network → Enable host networking** y aplicar el cambio. Docker Desktop puede reiniciarse; comprobar después que los demás proyectos recuperaron su estado. No es compatible con Enhanced Container Isolation.
3. Conservar el estado anterior de Casa Morra y la configuración de bucle local antes de recrear el contenedor. El modo host no admite `ports`: Nginx escucha directamente en `8088` y `compose.host.yaml` elimina el mapeo de Compose.
4. Revisar el firewall de Windows y el perímetro de la LAN. HTTP no tiene TLS ni autenticación; este procedimiento no autoriza acceso desde Internet.

Validar el modelo combinado sin activar el servicio:

```powershell
docker compose -p casa-morra -f compose.yaml -f compose.host.yaml config
```

## Activación y comprobación

Desde el checkout con la exportación pública validada:

```powershell
docker compose -p casa-morra -f compose.yaml -f compose.host.yaml up -d --build
docker inspect casa-morra-web-1 --format '{{.HostConfig.NetworkMode}} {{.State.Health.Status}}'
Invoke-WebRequest http://127.0.0.1:8088/health
Invoke-WebRequest http://192.168.0.52:8088/health
```

La recreación afecta al contenedor de Casa Morra; no usarla como prueba inocua. `docker inspect` debe indicar `host` y `healthy`, sin publicación `ports`. Comprobar también la portada, una ruta profunda, un activo y `/demo/snapshot.json`. Una solicitud desde otra máquina de `192.168.0.0/24` es necesaria para afirmar que el acceso LAN realmente funciona; una solicitud del propio anfitrión a su IP no alcanza para demostrarlo. El modo host de Docker Desktop trabaja en capa 4 y no permite vincular el proceso del contenedor exclusivamente a la IP física del anfitrión.

## Reversión

Desde un checkout con `.demo-public/` validado:

```powershell
docker compose -p casa-morra -f compose.yaml up -d --build
Invoke-WebRequest http://127.0.0.1:8088/health
```

Confirmar luego que `NetworkMode` indica la red bridge del proyecto Compose (por ejemplo, `casa-morra_default`), la publicación exclusiva `127.0.0.1:8088`, estado `healthy` y las rutas públicas. No deshabilitar automáticamente la opción global de Docker Desktop: otros proyectos pueden haber empezado a usarla.

Referencias: [red host de Docker](https://docs.docker.com/engine/network/drivers/host/) y [merge de Compose](https://docs.docker.com/reference/compose-file/merge/).

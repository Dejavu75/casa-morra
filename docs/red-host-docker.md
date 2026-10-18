# Red del host en Docker Desktop

Esta variante está **preparada, no activada**. El servicio habitual continúa en una red bridge y solo publica `127.0.0.1:8088`. La variante se selecciona explícitamente con `compose.host.yaml`; un `docker compose up` normal sigue usando `compose.yaml` y no cambia la exposición.

## Antes de activarla

1. Definir si el acceso externo será solo desde la red local o desde Internet. No se debe abrir el firewall ni el router sin esa decisión. El modo host **no** ofrece TLS, autenticación ni protección adicional para publicar HTTP en Internet.
2. En Docker Desktop 4.34 o posterior para contenedores Linux, habilitar «Enable host networking» en Settings → Resources → Network y aplicar el cambio. No es compatible con Enhanced Container Isolation. Esto requiere reiniciar Docker Desktop y puede interrumpir otros proyectos que estén ejecutándose. Confirmar una ventana operativa antes de hacerlo.
3. Verificar que el puerto **8080** esté libre y que el directorio `.demo-public/` de este checkout exista con la exportación pública demo validada. No reutilizar ni mover silenciosamente el almacén privado `.demo-state/`.
4. Hacer una copia verificable del estado actual y conservar el Compose de loopback para la reversión. La variante host sustituye el mapeo 8088→8080: `ports` se elimina deliberadamente porque Compose no admite mapeos junto a `network_mode: host`.

Se puede **validar sin activar** el modelo combinado:

```powershell
docker compose -f compose.yaml -f compose.host.yaml config
```

Después de confirmar el alcance y la ventana operativa, una activación explícita desde este checkout usaría el mismo proyecto Compose:

```powershell
docker compose -p casa-morra -f compose.yaml -f compose.host.yaml up -d --build
```

Esto recrea el contenedor `casa-morra-web-1`; no ejecutar como prueba inocua. En modo host, Nginx escucha en **8080** y Docker no muestra un mapeo `ports`. Comprobar `docker inspect` (`NetworkMode=host`, `Health.Status=healthy`), `http://127.0.0.1:8080/health`, el snapshot público y las vistas; una petición desde otra máquina de la red elegida es indispensable para afirmar acceso externo. El firewall de Windows, las reglas de red y cualquier proxy/TLS se gestionan por separado.

Para revertir, aplicar desde el checkout que conserva el Compose y la exportación pública anteriores:

```powershell
docker compose -p casa-morra -f compose.yaml up -d --build
```

Verificar de nuevo `127.0.0.1:8088/health`, el estado saludable y las rutas públicas. No deshabilitar la opción global de Docker Desktop ni reiniciarlo automáticamente: otros proyectos pueden estar utilizando red host.

La [documentación de Docker sobre red host](https://docs.docker.com/engine/network/drivers/host/) indica que Docker Desktop la ofrece como opción activable y que los mapeos de puertos se ignoran; la [especificación de merge de Compose](https://docs.docker.com/reference/compose-file/merge/) define `!reset []`.

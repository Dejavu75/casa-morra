# HTTPS de Casa Morra en el puerto 8080

El proxy TLS sirve las estadísticas en `https://ingenieros.deyzone.com.ar:8080/` sin sustituir la web HTTP del puerto 8088 ni exponer el panel administrativo del puerto 8090. Es un proyecto Compose independiente que se conecta a la red `casa-morra_default`.

## Activación local

1. Compruebe que la web esté saludable y que el puerto 8080 del anfitrión esté libre. El certificado de `ingenieros.deyzone.com.ar` debe estar vigente.
2. Desde la raíz del repositorio, defina las variables en la sesión de PowerShell, sin guardarlas en Git:

   ```powershell
   $env:CASA_MORRA_LAN_IP = '192.168.0.52'
   $env:CASA_MORRA_CERT_ROOT = 'C:/Sistema/ecosystem/volumenes/ecostore/certificados'
   node scripts/compose-tls.mjs config
   node scripts/compose-tls.mjs up -d --build proxy
   ```

3. Verifique el certificado y la respuesta sin desactivar su validación:

   ```powershell
   curl.exe --noproxy '*' --resolve 'ingenieros.deyzone.com.ar:8080:192.168.0.52' 'https://ingenieros.deyzone.com.ar:8080/health'
   curl.exe --noproxy '*' --resolve 'ingenieros.deyzone.com.ar:8080:192.168.0.52' -I 'https://ingenieros.deyzone.com.ar:8080/estadisticas'
   docker compose -p casa-morra-tls -f compose.tls.yaml ps proxy
   ```

## Aislamiento y operación

- El proxy monta **solo** `live/ingenieros.deyzone.com.ar` y `archive/ingenieros.deyzone.com.ar` en modo de solo lectura. Se necesitan ambas carpetas porque `live` contiene enlaces relativos a `archive`. No copie la clave privada ni cambie sus permisos; el proceso maestro de Nginx la lee como root y los trabajadores corren como `nginx`. Se eliminan las capacidades generales y se conceden únicamente `CHOWN`, `SETGID` y `SETUID` para preparar directorios temporales y bajar privilegios.
- El certificado sigue siendo responsabilidad del contenedor que lo renueva. Después de una renovación, reinicie **solo el proxy** para que Nginx cargue el nuevo certificado: `node scripts/compose-tls.mjs restart proxy`.
- No se activa HSTS mientras el mismo nombre pueda servir HTTP en 8088; HSTS forzaría HTTPS también para ese puerto. Las cabeceras de seguridad y la política CSP de la web se conservan al pasar por el proxy.
- Esta configuración liga 8080 únicamente a la IP LAN definida. No modifica DNS, redirección del router, firewall ni acceso desde Internet. La URL sin `--resolve` requiere que el nombre resuelva a un destino alcanzable.
- Para retirar solo HTTPS, ejecute `node scripts/compose-tls.mjs down`; la web y el panel permanecen independientes.

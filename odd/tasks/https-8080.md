# HTTPS de Casa Morra en 8080
Objetivo: servir las estadísticas con TLS para ingenieros.deyzone.com.ar sin alterar el sitio HTTP ni el panel administrativo.
Rama: feat/ux-audit-fixes. Entrega: ask-on-risk; sin push automático. Runner: node --test y Docker Compose/Nginx.

## Specs
- S1. Pedido literal: «Hacé que Casa Morra en 8080 use HTTPS usando el certificado ya creado para algún otro contenedor para ingenieros.deyzone.com.ar». Aceptación: `https://ingenieros.deyzone.com.ar:8080/estadisticas` presenta certificado válido para ese nombre y la página responde 200.
- S2. Supuesto operativo: 8080 es el puerto del anfitrión en la IP LAN actual; se conserva `192.168.0.52:8088` y el panel `127.0.0.1:8090`. No se cambia DNS, firewall, enrutamiento externo, CH09 ni FD03. Aceptación: identidades y datos actuales invariantes.
- S3. Restricción técnica: reutilizar únicamente las carpetas `live` y `archive` del certificado de CH09 como montajes de solo lectura; no copiar ni cambiar permisos de la clave. Aceptación: Compose y runtime muestran los montajes acotados, Nginx puede leerlos y no expone el administrador.

## Tasks
- T1 [S1-S3] inline; verificado; proxy TLS aislado, pruebas de Compose/configuración y guía operativa; commit pendiente.
- T2 [S1-S3] inline; verificado con límite de prueba histórica; HTTPS 8080 y certificado válidos, web/admin existentes intactos; verificador independiente sin bloqueos; commit pendiente.

## Log
- L1. Usuario: «Hacé que Casa Morra en 8080 use HTTPS usando el certificado ya creado para algún otro contenedor para ingenieros.deyzone.com.ar».
- L2. Evidencia: `ch09-brk-certbot` monta el certificado válido para `ingenieros.deyzone.com.ar` hasta 2026-12-26; FD03 tiene copia vencida. Puerto anfitrión 8080 libre. Casa Morra HTTP sigue en bridge `192.168.0.52:8088` y admin en loopback `8090`.
- L3. Diseño: proxy Nginx independiente en bridge `casa-morra_default`, TLS host 8080 → upstream `web:8088`, montajes de certificado acotados y de solo lectura. No HSTS mientras exista HTTP 8088 en el mismo nombre. Pronóstico: unas 200-300 líneas de código, pruebas y guía; no requiere cadena por tamaño.
- L4. RED: `node --test test/tls-compose.test.mjs` falló 3/3 antes de crear el proxy. GREEN: 3/3. Suite: `npm test` 266 aprobadas, 5 omitidas, 0 fallidas; `npm run verify:data` correcto. `nginx -t` pasó después de conceder solamente CHOWN, SETGID y SETUID.
- L5. Runtime: `casa-morra-tls-proxy-1` saludable en `192.168.0.52:8080`; `curl --resolve` sin omitir validación TLS devolvió 200 en `/estadisticas`, certificado SAN correcto y vigente hasta 2026-12-26. HTTP 8088 dio 200; web, admin y certbot conservaron sus IDs. El dominio sin `--resolve` no conectó desde este anfitrión; no se cambió DNS/firewall/router. No se tomó hash de datos anterior a la activación, por lo que su invariancia histórica no está probada por hash.
- L6. Verificación independiente: S1 y S3 aprobadas; S2 aprobada con la limitación del hash histórico. `/admin` vía HTTPS devuelve el fallback SPA público, no el servicio administrativo; este sigue ligado a loopback. `nginx -t`, pruebas TLS en copia temporal y `git diff --check` aprobaron. La eliminación de la copia temporal fue denegada por política del ejecutor y quedó pendiente.

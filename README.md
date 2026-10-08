# Casa Morra

Sitio independiente de ajedrez en español, con datos ficticios de demostración. Nginx sirve el sitio estático desde `dist/`; no hay backend, cuentas ni datos del club de referencia.

## Verificación local

Requiere Node.js 22 para las pruebas nativas y Docker con Compose para ejecutar el sitio. No se instalan paquetes de Node.

```powershell
node --test
npm run verify:data
node scripts/demo-snapshot.mjs
docker compose config
docker compose up --build -d
docker compose ps
Invoke-WebRequest http://127.0.0.1:8088/health
Invoke-WebRequest http://127.0.0.1:8088/
docker compose down
```

La aplicación está disponible en <http://127.0.0.1:8088/>. Compose publica exclusivamente en el bucle local. No reemplazar `127.0.0.1` por `0.0.0.0` ni considerar un HTTP 200 o un contenedor saludable como aceptación funcional o visual.

La imagen usa una base Nginx fijada por digest y ejecuta el proceso como usuario sin privilegios en el puerto interno 8080. El sistema de archivos del contenedor es de solo lectura, salvo el montaje temporal `/tmp` requerido por Nginx. Se eliminan las capacidades Linux y se prohíbe adquirir privilegios adicionales. El contexto Docker excluye Git, pruebas, documentación, scripts y archivos `.env*`.

El servidor entrega rutas de la SPA mediante `index.html`, pero responde 404 para módulos y recursos estáticos inexistentes (por ejemplo, `/views/no-existe.js`, `/data/no-existe.js` o `/assets/no-existe.js`). Aplica una CSP de recursos del mismo origen y encabezados contra interpretación de tipos e incrustación. No aplica HSTS porque el despliegue local no usa HTTPS.

Nginx ofrece gzip para HTML y recursos textuales de al menos 1 KiB, con `Vary: Accept-Encoding`; las imágenes PNG no se comprimen de nuevo. La prueba de contenedor compara los bytes descomprimidos con la respuesta sin gzip y comprueba rutas profundas, errores 404 y cabeceras de seguridad. Esta mejora afecta solo al texto: las imágenes dominan la transferencia inicial, por lo que no se afirma una mejora perceptible de carga. No se agregan encabezados de caché duradera sin nombres de archivo versionados.

El [esquema del snapshot demo](docs/esquema-datos-demo.md) describe el formato JSON determinista y sus límites; no hay importador ni base de datos. Las estadísticas se comprueban con `npm run verify:data`. Esto no sustituye el QA de navegador, teclado y lector de pantalla.

El botón «Modo oscuro» conserva el mismo nombre accesible al alternar el tema; `aria-pressed` indica si el modo oscuro está activo. Esta semántica tiene prueba automatizada, pero no sustituye una comprobación con lector de pantalla.

## Integración continua

`.github/workflows/verify.yml` ejecuta `npm test`, `npm run verify:data` y una construcción Docker en `push` y `pull_request`. La imagen de CI se construye solo para validar el paquete: no se publica ni se accede a secretos. El trabajo usa permisos de lectura y referencias SHA completas para [checkout](https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1) y [setup-node](https://github.com/actions/setup-node/commit/820762786026740c76f36085b0efc47a31fe5020), conforme a la [guía de seguridad de GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use).

Tras la construcción, CI inicia una instancia efímera enlazada a `127.0.0.1:18089`, ejecuta `test/gzip-runtime.test.mjs` contra respuestas HTTP reales y retira el contenedor. En `npm test` sin `CASA_MORRA_TEST_URL`, esos casos se omiten expresamente; para ejecutarlos localmente se necesita un contenedor de esta rama en ese puerto y `CASA_MORRA_TEST_URL=http://127.0.0.1:18089 node --test test/gzip-runtime.test.mjs`.

La configuración y los comandos pueden validarse localmente, pero **ninguna ejecución de GitHub Actions queda comprobada hasta que se publique esta rama y el servicio informe el resultado**. Tampoco reemplaza las pruebas visuales y de accesibilidad en un navegador real.

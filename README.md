# Casa Morra

Sitio independiente de ajedrez en español, con datos ficticios de demostración. Nginx sirve el sitio estático desde `dist/`; no hay backend, cuentas ni datos del club de referencia.

## Verificación local

Requiere Node.js 22 para las pruebas nativas y Docker con Compose para ejecutar el sitio. No se instalan paquetes de Node.

```powershell
node --test
npm run verify:data
node scripts/demo-snapshot.mjs
docker compose config
node scripts/demo-store.mjs init --store .demo-state/casa-morra.json
node scripts/demo-public.mjs publish --store .demo-state/casa-morra.json --output .demo-public/snapshot.json
docker compose up --build -d
docker compose ps
Invoke-WebRequest http://127.0.0.1:8088/health
Invoke-WebRequest http://127.0.0.1:8088/
docker compose down
```

La aplicación está disponible en <http://127.0.0.1:8088/>. Compose publica exclusivamente en el bucle local. No reemplazar `127.0.0.1` por `0.0.0.0` ni considerar un HTTP 200 o un contenedor saludable como aceptación funcional o visual.

La imagen usa una base Nginx fijada por digest y ejecuta el proceso como usuario sin privilegios en el puerto interno 8080. El sistema de archivos del contenedor es de solo lectura, salvo el montaje temporal `/tmp` requerido por Nginx. Se eliminan las capacidades Linux y se prohíbe adquirir privilegios adicionales. El contexto Docker excluye Git, pruebas, documentación, scripts, archivos `.env*`, el almacén `.demo-state/` y la exportación `.demo-public/`.

Compose exige un directorio `.demo-public/` **existente** y lo monta en modo de solo lectura fuera del docroot; no crea el directorio por omisión. La publicación explícita anterior lo prepara. Solo `/demo/snapshot.json` lee el archivo exportado: responde 200 con JSON ficticio o 404 si aún falta, siempre con `Cache-Control: no-store` y las mismas cabeceras de seguridad que el resto del sitio. Nunca se monta `.demo-state/`. La interfaz muestra primero el fixture y luego consulta el JSON público; valida formato e integridad con WebCrypto y actualiza las vistas. Si la consulta tarda más de cinco segundos o falla, mantiene el fixture y muestra un aviso. Después de un cambio en el almacén hay que ejecutar de nuevo `publish` y pulsar «Actualizar datos» o navegar; no hay publicación automática. Para aislar una prueba, fijá `CASA_MORRA_HTTP_PORT=18089` y un proyecto Compose distinto; el servicio habitual permanece en 8088.

El servidor entrega rutas de la SPA mediante `index.html`, pero responde 404 para módulos y recursos estáticos inexistentes (por ejemplo, `/views/no-existe.js`, `/data/no-existe.js` o `/assets/no-existe.js`). Aplica una CSP de recursos del mismo origen y encabezados contra interpretación de tipos e incrustación. No aplica HSTS porque el despliegue local no usa HTTPS.

Nginx ofrece gzip para HTML y recursos textuales de al menos 1 KiB, con `Vary: Accept-Encoding`; las imágenes PNG no se comprimen de nuevo. La prueba de contenedor compara los bytes descomprimidos con la respuesta sin gzip y comprueba rutas profundas, errores 404 y cabeceras de seguridad. Esta mejora afecta solo al texto: las imágenes dominan la transferencia inicial, por lo que no se afirma una mejora perceptible de carga. No se agregan encabezados de caché duradera sin nombres de archivo versionados.

El [esquema del snapshot demo](docs/esquema-datos-demo.md) describe el formato JSON determinista, las operaciones locales y sus límites; no hay base de datos multiusuario. La [procedencia de los datos y recursos demo](docs/procedencia-demo.md) identifica el fixture y las imágenes por SHA-256, con el alcance de la inspección de originalidad y sus límites de privacidad. Las estadísticas se comprueban con `npm run verify:data`. El [procedimiento de entrega y reversión](docs/entrega-0.9.0-demo.md) separa la prueba aislada del servicio habitual. Esto no sustituye el QA de navegador, teclado y lector de pantalla.

El botón «Modo oscuro» conserva el mismo nombre accesible al alternar el tema; `aria-pressed` indica si el modo oscuro está activo. Esta semántica tiene prueba automatizada, pero no sustituye una comprobación con lector de pantalla.

## Integración continua

`.github/workflows/verify.yml` ejecuta `npm test`, `npm run verify:data` y una construcción Docker en `push` y `pull_request`. La imagen de CI se construye solo para validar el paquete: no se publica ni se accede a secretos. El trabajo usa permisos de lectura y referencias SHA completas para [checkout](https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1) y [setup-node](https://github.com/actions/setup-node/commit/820762786026740c76f36085b0efc47a31fe5020), conforme a la [guía de seguridad de GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use).

Tras la construcción, CI inicia una instancia efímera enlazada a `127.0.0.1:18089`, comprueba gzip y la ruta pública primero ausente (404) y después publicada (200), y retira el contenedor. En `npm test` sin `CASA_MORRA_TEST_URL`, esos casos se omiten expresamente; para ejecutarlos localmente se necesita un contenedor de esta rama en ese puerto.

La ejecución de CI de una rama anterior no prueba este commit: para cada entrega se verifica el resultado del SHA exacto en GitHub Actions. CI tampoco reemplaza las pruebas visuales y de accesibilidad en un navegador real.

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

Compose configura `restart: unless-stopped`: Docker reinicia el servicio tras una salida o un reinicio del motor si no se lo detuvo expresamente. `docker compose down` lo detiene y elimina; para volver a servir el sitio, ejecutar `docker compose up -d`. Esta política no inicia Docker Desktop ni reemplaza la comprobación de `/health` y las rutas después de reiniciar el equipo.

La imagen usa una base Nginx fijada por digest y ejecuta el proceso como usuario sin privilegios en el puerto interno 8080. El sistema de archivos del contenedor es de solo lectura, salvo el montaje temporal `/tmp` requerido por Nginx. Se eliminan las capacidades Linux y se prohíbe adquirir privilegios adicionales. El contexto Docker excluye Git, pruebas, documentación, scripts, archivos `.env*`, el almacén `.demo-state/` y la exportación `.demo-public/`.

Compose exige un directorio `.demo-public/` **existente** y lo monta en modo de solo lectura fuera del docroot; no crea el directorio por omisión. La publicación explícita anterior lo prepara. Solo `/demo/snapshot.json` lee el archivo exportado: responde 200 con JSON ficticio o 404 si aún falta, siempre con `Cache-Control: no-store` y las mismas cabeceras de seguridad que el resto del sitio. Nunca se monta `.demo-state/`. La interfaz muestra primero el fixture y declara esa fuente antes de ejecutar JavaScript; luego consulta el JSON público, valida formato e integridad con WebCrypto y actualiza las vistas y el estado de la fuente. Si la consulta tarda más de cinco segundos o falla, mantiene el fixture: el estado visible indica «Actualización fallida; datos de ejemplo» y «Detalles de la fuente» conserva el aviso completo en un control desplegable accesible por teclado. Después de un cambio en el almacén hay que ejecutar de nuevo `publish` y pulsar «Actualizar datos» o navegar; no hay publicación automática. Para aislar una prueba, fijá `CASA_MORRA_HTTP_PORT=18089` y un proyecto Compose distinto; el servicio habitual permanece en 8088.

El servidor entrega rutas de la SPA mediante `index.html`, pero responde 404 para módulos y recursos estáticos inexistentes (por ejemplo, `/views/no-existe.js`, `/data/no-existe.js` o `/assets/no-existe.js`). Aplica una CSP de recursos del mismo origen y encabezados contra interpretación de tipos e incrustación. No aplica HSTS porque el despliegue local no usa HTTPS.

Nginx ofrece gzip para HTML y recursos textuales de al menos 1 KiB, con `Vary: Accept-Encoding`; las imágenes PNG no se comprimen de nuevo. La prueba de contenedor compara los bytes descomprimidos con la respuesta sin gzip y comprueba rutas profundas, errores 404 y cabeceras de seguridad. Esta mejora afecta solo al texto: las imágenes dominan la transferencia inicial, por lo que no se afirma una mejora perceptible de carga. No se agregan encabezados de caché duradera sin nombres de archivo versionados.

El origen local se reutiliza entre entregas. Nginx envía `Cache-Control: no-cache` para exigir revalidación, conservando el `no-store` del snapshot público. La entrega `0.9.2-demo` cambia además las URL del CSS, del módulo principal y del módulo de récords para evitar reutilizar sus versiones anteriores; las demás rutas y módulos no cambiaron desde `0.9.1-demo`. Si el navegador ya conservaba el **HTML antiguo**, las cabeceras nuevas todavía no pueden afectarlo: ingresá por <http://127.0.0.1:8088/?entrega=0.9.2-demo> para recibir el documento nuevo sin vaciar la caché. Una URL antigua puede seguir mostrando la versión anterior hasta que venza su caché o se recargue expresamente. La candidata `0.9.3-demo` versiona las entradas CSS/JS, las hojas modificadas y todas las importaciones que conducen a los módulos modificados de idioma, perfiles, editorial y estadísticas. La primera candidata no versionaba sus dependencias: un navegador reutilizó módulos antiguos desde disco aun con la entrada nueva. Los demás módulos conservan la revalidación `no-cache`. La revalidación agrega solicitudes condicionales, pero evita retransmitir necesariamente las imágenes.

El [esquema del snapshot demo](docs/esquema-datos-demo.md) describe el formato JSON determinista, las operaciones locales y sus límites; no hay base de datos multiusuario. La [procedencia de los datos y recursos demo](docs/procedencia-demo.md) identifica el fixture y las imágenes por SHA-256, con el alcance de la inspección de originalidad y sus límites de privacidad. Las estadísticas se comprueban con `npm run verify:data`. El [procedimiento de entrega y reversión](docs/entrega-0.9.0-demo.md) separa la prueba aislada del servicio habitual. Esto no sustituye el QA de navegador, teclado y lector de pantalla.

La [guía de la entrega `0.9.1-demo`](docs/entrega-0.9.1-demo.md) amplía ese procedimiento para el estado de exportación, la preparación multilenguaje y la política de reinicio. Describe cómo comprobar y revertir esa entrega; no es una indicación del estado actual del contenedor.

La [guía de la entrega `0.9.2-demo`](docs/entrega-0.9.2-demo.md) documenta las mejoras visuales, la precisión del récord Elo y la reversión local a `0.9.1-demo`. La prerelease pública de GitHub `v0.9.2-demo` apunta a `5dc4963`. El 18/10/2026, `127.0.0.1:8088` servía HTML con recursos `0.9.2-demo`, pero todavía no incluía el favicon de la rama 71. Esta observación no significa que las ramas posteriores ya estén desplegadas; antes de cada entrega se debe comprobar el contenedor y el commit exacto.

La [guía candidata `0.9.3-demo`](docs/entrega-0.9.3-demo.md) documenta el ensayo aislado, la reversión de `0.9.2-demo` y las comprobaciones requeridas antes de una nueva publicación. No presume que las ramas posteriores estén desplegadas.

El botón «Modo oscuro» conserva el mismo nombre accesible al alternar el tema; `aria-pressed` indica si el modo oscuro está activo. Esta semántica tiene prueba automatizada, pero no sustituye una comprobación con lector de pantalla.

En pantallas angostas, la tabla de «Clases» recibe foco con Tab como región desplazable. Toma su nombre del título visible de la tabla y muestra un contorno de foco. El desplazamiento horizontal mediante flechas no se pudo confirmar con el mecanismo de entrada del navegador utilizado; tampoco se realizó una auditoría completa con tecnologías de asistencia.

## Integración continua

`.github/workflows/verify.yml` ejecuta `npm test`, `npm run verify:data` y una construcción Docker en `push` y `pull_request`. La imagen de CI se construye solo para validar el paquete: no se publica ni se accede a secretos. El trabajo usa permisos de lectura y referencias SHA completas para [checkout](https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1) y [setup-node](https://github.com/actions/setup-node/commit/820762786026740c76f36085b0efc47a31fe5020), conforme a la [guía de seguridad de GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use).

Tras la construcción, CI inicia una instancia efímera enlazada a `127.0.0.1:18089`, comprueba gzip y la ruta pública primero ausente (404) y después publicada (200), y retira el contenedor. En `npm test` sin `CASA_MORRA_TEST_URL`, esos casos se omiten expresamente; para ejecutarlos localmente se necesita un contenedor de esta rama en ese puerto.

La ejecución de CI de una rama anterior no prueba este commit: para cada entrega se verifica el resultado del SHA exacto en GitHub Actions. CI tampoco reemplaza las pruebas visuales y de accesibilidad en un navegador real.

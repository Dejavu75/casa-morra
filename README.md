# Casa Morra

Sitio independiente de estadísticas de ajedrez en español, con datos ficticios de demostración. Nginx sirve las estadísticas públicas desde `dist/`. El servicio administrativo opcional de Node queda separado y limitado al bucle local; no se incluyen datos del club de referencia.

## Experiencia estadística

La portada `/` y `/estadisticas` muestran el mismo tablero: totales de jugadores, torneos y partidas al tablero, diez clasificaciones y reglas de cálculo visibles. La navegación pública ofrece estadísticas, jugadores, torneos, clásicos, Elo y Enciclopedia. Los perfiles de jugadores muestran partidas y resultados por color; los torneos incluyen fechas y tablas, y las partidas con jugadas pueden reproducirse. `/comparar` permite elegir cualquier pareja para ver su balance directo, también separado por color. `/elo` lista jugadores, dibuja una evolución temporal y permite seleccionar varios para comparar en el mismo gráfico. El Elo es interno de demostración, no FIDE, y los valores visibles se redondean a enteros. `/enciclopedia` filtra por jugador y torneo y lista los resultados; ofrece un archivo PGN generado a partir de las jugadas validadas cuando existen, o indica «PGN pendiente». Las rutas de noticias, clases, fotos y contenido institucional continúan fuera de la experiencia pública. El idioma publicado es español y los textos de las vistas se mantienen en catálogos para incorporar otros idiomas más adelante.

Los totales y clasificaciones se calculan sobre el fixture original o sobre la exportación pública verificada que el sitio cargue. «Datos de demostración» permanece visible; no son estadísticas del club de referencia.

La identidad visual usa azul marino, blanco y acentos cálidos para convivir con la estética del Club Náutico San Isidro sin replicar su portal. En pantallas estrechas, la navegación estadística se abre con un botón «Menú» accesible por teclado.

## Verificación local

Requiere Node.js 22 para las pruebas nativas y Docker con Compose para ejecutar el sitio. `npm ci` instala la dependencia de ajedrez fijada en `package-lock.json` antes de las pruebas.

```powershell
npm ci
node --test
npm run verify:data
node scripts/demo-snapshot.mjs
docker compose config
node scripts/docker-prepare.mjs
docker compose up --build -d
docker compose ps
Invoke-WebRequest http://127.0.0.1:8088/health
Invoke-WebRequest http://127.0.0.1:8088/
docker compose down
```

El Compose base publica en <http://127.0.0.1:8088/>. La instalación LAN actual añade `compose.lan.yaml` con `CASA_MORRA_LAN_IP=192.168.0.52` y se consulta en <http://192.168.0.52:8088/estadisticas>. No reemplazar la IP por `0.0.0.0` ni considerar un HTTP 200 o un contenedor saludable como aceptación funcional o visual. Para instalar web y panel en otro equipo, seguir la [guía Docker portable](docs/docker-otro-host.md).

El acceso HTTPS opcional en `ingenieros.deyzone.com.ar:8080` usa un proxy aislado y el certificado vigente de otro contenedor, sin mover el sitio HTTP ni el panel. Consulte la [guía de HTTPS en 8080](docs/https-8080.md) antes de activarlo.

Compose configura `restart: unless-stopped`: Docker reinicia el servicio tras una salida o un reinicio del motor si no se lo detuvo expresamente. `docker compose down` lo detiene y elimina; para volver a servir el sitio, ejecutar `docker compose up -d`. Esta política no inicia Docker Desktop ni reemplaza la comprobación de `/health` y las rutas después de reiniciar el equipo.

La imagen usa una base Nginx fijada por digest y ejecuta el proceso como usuario sin privilegios en el puerto interno 8088. El sistema de archivos del contenedor es de solo lectura, salvo el montaje temporal `/tmp` requerido por Nginx. Se eliminan las capacidades Linux y se prohíbe adquirir privilegios adicionales. El contexto Docker excluye Git, pruebas, documentación, scripts, archivos `.env*`, el almacén `.demo-state/` y la exportación `.demo-public/`.

Compose exige un directorio `.demo-public/` **existente** y lo monta en modo de solo lectura fuera del docroot; no crea el directorio por omisión. La publicación explícita anterior lo prepara. Solo `/demo/snapshot.json` lee el archivo exportado: responde 200 con JSON ficticio o 404 si aún falta, siempre con `Cache-Control: no-store` y las mismas cabeceras de seguridad que el resto del sitio. Nunca se monta `.demo-state/` en el servicio público. La interfaz muestra primero el fixture y declara esa fuente antes de ejecutar JavaScript; luego consulta el JSON público, valida formato, longitud e integridad SHA-256 y actualiza las vistas y el estado de la fuente. Utiliza WebCrypto cuando está disponible y una implementación local probada de SHA-256 en HTTP LAN sin `SubtleCrypto`; esto detecta alteraciones accidentales, pero no autentica el servidor ni reemplaza HTTPS. Si la consulta tarda más de cinco segundos o falla la validación, mantiene el fixture: el estado visible indica «Actualización fallida; datos de ejemplo» y «Detalles de la fuente» conserva el aviso completo en un control desplegable accesible por teclado. Tras un cambio por CLI hay que ejecutar `publish` y actualizar la vista; el panel administrativo opcional publica automáticamente y ofrece reintento ante fallos. Para aislar una prueba, fijá `CASA_MORRA_HTTP_PORT=18089` y un proyecto Compose distinto; el servicio habitual permanece en 8088.

El servidor entrega rutas de la SPA mediante `index.html`, pero responde 404 para módulos y recursos estáticos inexistentes (por ejemplo, `/views/no-existe.js`, `/data/no-existe.js` o `/assets/no-existe.js`). Aplica una CSP de recursos del mismo origen y encabezados contra interpretación de tipos e incrustación. No aplica HSTS porque el despliegue local no usa HTTPS.

Nginx ofrece gzip para HTML y recursos textuales de al menos 1 KiB, con `Vary: Accept-Encoding`; las imágenes PNG no se comprimen de nuevo. La prueba de contenedor compara los bytes descomprimidos con la respuesta sin gzip y comprueba rutas profundas, errores 404 y cabeceras de seguridad. Esta mejora afecta solo al texto: las imágenes dominan la transferencia inicial, por lo que no se afirma una mejora perceptible de carga. No se agregan encabezados de caché duradera sin nombres de archivo versionados.

El origen local se reutiliza entre entregas. Nginx envía `Cache-Control: no-cache` para exigir revalidación, conservando el `no-store` del snapshot público. La entrega `0.9.2-demo` cambia además las URL del CSS, del módulo principal y del módulo de récords para evitar reutilizar sus versiones anteriores; las demás rutas y módulos no cambiaron desde `0.9.1-demo`. Si el navegador ya conservaba el **HTML antiguo**, las cabeceras nuevas todavía no pueden afectarlo: ingresá por <http://127.0.0.1:8088/?entrega=0.9.2-demo> para recibir el documento nuevo sin vaciar la caché. Una URL antigua puede seguir mostrando la versión anterior hasta que venza su caché o se recargue expresamente. La candidata `0.9.3-demo` versiona las entradas CSS/JS, las hojas modificadas y todas las importaciones que conducen a los módulos modificados de idioma, perfiles, editorial y estadísticas. La primera candidata no versionaba sus dependencias: un navegador reutilizó módulos antiguos desde disco aun con la entrada nueva. Los demás módulos conservan la revalidación `no-cache`. La revalidación agrega solicitudes condicionales, pero evita retransmitir necesariamente las imágenes.

El [esquema del snapshot demo](docs/esquema-datos-demo.md) describe el formato JSON determinista, las operaciones locales y sus límites; no hay base de datos multiusuario. La [procedencia de los datos y recursos demo](docs/procedencia-demo.md) identifica el fixture y las imágenes por SHA-256, con el alcance de la inspección de originalidad y sus límites de privacidad. Las estadísticas se comprueban con `npm run verify:data`. El [procedimiento de entrega y reversión](docs/entrega-0.9.0-demo.md) separa la prueba aislada del servicio habitual. Esto no sustituye el QA de navegador, teclado y lector de pantalla.

La [variante bridge para la LAN](docs/red-lan-docker.md) publica Casa Morra únicamente en la IP indicada por `CASA_MORRA_LAN_IP`; la instalación actual usa `192.168.0.52:8088`. El Compose base conserva el acceso exclusivo por bucle local y sirve como reversión. La [variante de red del host](docs/red-host-docker.md) es opcional, pero escucha en todas las interfaces disponibles y requiere controles de firewall adecuados antes de su activación.

La [guía de la entrega `0.9.1-demo`](docs/entrega-0.9.1-demo.md) amplía ese procedimiento para el estado de exportación, la preparación multilenguaje y la política de reinicio. Describe cómo comprobar y revertir esa entrega; no es una indicación del estado actual del contenedor.

La [guía de la entrega `0.9.2-demo`](docs/entrega-0.9.2-demo.md) documenta las mejoras visuales, la precisión del récord Elo y la reversión local a `0.9.1-demo`. La prerelease pública de GitHub `v0.9.2-demo` apunta a `5dc4963`. El 18/10/2026, `127.0.0.1:8088` servía HTML con recursos `0.9.2-demo`, pero todavía no incluía el favicon de la rama 71. Esta observación no significa que las ramas posteriores ya estén desplegadas; antes de cada entrega se debe comprobar el contenedor y el commit exacto.

La [guía candidata `0.9.3-demo`](docs/entrega-0.9.3-demo.md) documenta el ensayo aislado, la reversión de `0.9.2-demo` y las comprobaciones requeridas antes de una nueva publicación. No presume que las ramas posteriores estén desplegadas.

## Administración local de partidas

El panel opcional permite **crear un resultado sin jugadas** y completar después esa misma partida, de forma manual o mediante PGN. Solo usuarios que conozcan la contraseña administrativa pueden escribir. El acceso está limitado a <http://127.0.0.1:8090/> en el equipo servidor; no se publica en `192.168.0.52` ni en el puerto público 8088. No reutilices la contraseña del sitio de referencia.

Antes del primer arranque, prepará `.demo-state/admin.json` y la exportación pública con `node scripts/docker-prepare.mjs` o con el servicio de preparación de la [guía Docker portable](docs/docker-otro-host.md). Repetir la preparación no reemplaza un almacén existente. El administrador necesita una contraseña elegida por el operador; no hay contraseña predeterminada:

```powershell
node scripts/docker-prepare.mjs
$segura = Read-Host 'Contraseña administrativa nueva' -AsSecureString
$env:CASA_MORRA_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $segura).Password
docker compose -p casa-morra -f compose.admin.yaml up --build -d admin
docker compose -p casa-morra -f compose.admin.yaml ps admin
Invoke-WebRequest http://127.0.0.1:8090/health
Remove-Item Env:CASA_MORRA_ADMIN_PASSWORD
```

El comando `init` es solo para un almacén inexistente. `compose.admin.yaml` monta `.demo-state/` y `.demo-public/` con escritura **únicamente en el contenedor administrativo**; el Nginx público sigue montando solo `.demo-public/` en modo lectura. Tras guardar, el panel exporta el snapshot público. Si falla la exportación, informa «publicación pendiente» y permite reintentar sin duplicar la partida. El contrato está en [admin-api.md](docs/admin-api.md) y las reglas de PGN y tablas en [carga-partidas.md](docs/carga-partidas.md).

La opción `-p casa-morra` conserva el proyecto Compose del servicio público aunque los comandos se ejecuten desde otro worktree. Sin ella, Compose usa el nombre del directorio actual y puede crear una pila separada. En la instalación actual, la contraseña generada está en el archivo local `.env`, ignorado por Git; consérvalo fuera del repositorio remoto y reemplázala si deja de ser privada.

Esta autenticación es deliberadamente simple y local. Docker conserva las variables de entorno en su configuración; no uses este montaje en un host compartido ni expongas el puerto administrativo a la LAN/Internet sin HTTPS y controles adicionales. En contenedores de prueba aislados se verificaron con navegador el acceso, la carga de un resultado y su actualización por PGN sin duplicar la partida. La imagen de la rama 89 se comprobó aparte para el nuevo selector de torneos. No se realizó una auditoría con lector de pantalla ni una prueba del panel en el host destino.

El botón «Modo oscuro» conserva el mismo nombre accesible al alternar el tema; `aria-pressed` indica si el modo oscuro está activo. Esta semántica tiene prueba automatizada, pero no sustituye una comprobación con lector de pantalla.

No se realizó una auditoría completa con tecnologías de asistencia. Las pruebas de teclado y ARIA documentadas corresponden a componentes conservados en el código, pero no convierten esas secciones históricas en parte de la experiencia pública estadística actual.

## Integración continua

`.github/workflows/verify.yml` instala las dependencias fijadas con `npm ci`, ejecuta `npm test` y `npm run verify:data`, y construye las imágenes Docker pública y administrativa en `push` y `pull_request`. Las imágenes de CI se construyen solo para validar el paquete: no se publican ni se accede a secretos. El trabajo usa permisos de lectura y referencias SHA completas para [checkout](https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1) y [setup-node](https://github.com/actions/setup-node/commit/820762786026740c76f36085b0efc47a31fe5020), conforme a la [guía de seguridad de GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use).

Tras la construcción, CI inicia una instancia efímera enlazada a `127.0.0.1:18089`, comprueba gzip y la ruta pública primero ausente (404) y después publicada (200), y retira el contenedor. En `npm test` sin `CASA_MORRA_TEST_URL`, esos casos se omiten expresamente; para ejecutarlos localmente se necesita un contenedor de esta rama en ese puerto.

La ejecución de CI de una rama anterior no prueba este commit: para cada entrega se verifica el resultado del SHA exacto en GitHub Actions. CI tampoco reemplaza las pruebas visuales y de accesibilidad en un navegador real.

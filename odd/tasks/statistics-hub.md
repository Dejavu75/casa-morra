# Centro estadístico de Casa Morra

Objetivo: recuperar las áreas públicas de estadísticas y completar el boceto sin contenido editorial.
Rama: `feat/casa-morra-statistics-hub`. Entrega: rama local por unidades; sin publicación remota implícita. Runner: `npm test`, `npm run verify:data` y comprobación HTTP en Docker local. Estrategia: `exception-ok` (excepción de tamaño previamente autorizada; sin PR solicitado).

## Specs

S1. «Cuando me refería a solo estadísticas no era sacar todo eso que ya existe, si no, sacar la parte de problemas a resolver, noticias, fotos, etcs.. volvé a agregar todo lo faltante». Alcance: recuperar Jugadores, Torneos y Partidas públicas, conservar ocultos los contenidos editoriales. Aceptación: navegación y rutas estadísticas accesibles; las editoriales siguen redirigidas.
S2. «No hay busqueda por jugador en donde se pueda luego ver en el jugador estadísticas de ganadas y perdidas con cada color, Elo, canbtidad de partidas.» y «Buscar comparativa Jugador VS Jugador» (boceto). Alcance: búsqueda, perfil y comparación cara a cara; aceptar resultados sin PGN.
S3. «Tampoco centrado en los Torneos, con un listado, fecha, tabla del torneo..». Alcance: listado y detalle con fecha y clasificación.
S4. «Tampoco centrado en el ELO, con el listado de jugadores y al entrar una linea de tiempo y grafico. Tampoco la posibilidad de agregar jugadores a la linea para comparar la evolucion.» y «Los ELOs no tiene decimales». Alcance: ranking, gráfico temporal individual y comparación multijugador; cifras enteras visibles y aviso de Elo interno demo.
S5. «Tmpoco la parte de Enciclopedia». Boceto: filtros por jugador y torneos, tabla «Rival», «Torneo», «Fecha», «Resultado», «Archivo PGN». Alcance: consulta combinable sobre partidas, con estado explícito cuando todavía no hay PGN.
S6. «Esta página será complementaria por lo que debería mantener la misma estética y gama de colores para amalgamar» y «tambien realiza tu consejo del cambio de colores». Alcance: adaptar las pantallas estadísticas a azul marino/blanco compatible con CNSI, conservando identidad Casa Morra; comprobar contraste y responsive.

## Tasks

- [x] T1 · S1-S3 · ruta inline · reabrir navegación estadística, perfiles, torneos y partidas; RED 2/3, GREEN 3/3, suite 240/245 (5 omitidas); commit `8dba5f0`.
- [x] T2 · S4 · ruta inline · página Elo, gráfica temporal, comparación, enteros visibles; RED 3, GREEN 12/12, suite 242 aprobadas (5 omitidas); commit `48fa03c`.
- [x] T3 · S2, S5 · ruta inline · comparación jugador-jugador y Enciclopedia filtrable con PGN opcional; RED 3, GREEN 3/3, suite 245 aprobadas (5 omitidas); commit `baeb59d`.
- [x] T4 · S6 · ruta inline · armonización cromática CNSI y QA responsive/accesibilidad; RED 2, GREEN 7/7, suite 247 aprobadas (5 omitidas); commit pendiente.
- [ ] T5 · S1-S6 · ruta inline · suite, datos, Docker local y verificación final; sin commit si no hay cambios.

## Log

L1 (2026-11-02): «Cuando me refería a solo estadísticas no era sacar todo eso que ya existe, si no, sacar la parte de problemas a resolver, noticias, fotos, etcs.. volvé a agregar todo lo faltante».
L2 (2026-11-02): «tambien realiza tu consejo del cambio de colores».
L3: Evidencia: `dist/assets/app.js` conserva renderers de jugadores/torneos/partidas pero `resolvePublicRoute` los redirige; `dist/index.html` solo navega a estadísticas. CNSI usa cabecera azul marino, blanco y escudo centrado; Casa Morra usa overrides verdes en `dist/assets/stats.css`.
L4: Previsión: aproximadamente 700-1000 líneas authored, repartidas en unidades funcionales. No se reintroducen problemas, novedades, fotos, clases ni socios.
L5: T1 reabrió `/jugadores`, `/torneos`, `/anual`, `/clasicos` y `/partidas/:id`; la navegación lista solo las áreas disponibles. La suite inicial detectó un test de shell obsoleto, actualizado a cuatro enlaces; suite final 240 aprobadas, 5 omitidas.
L6: T2 añadió `/elo` con ranking, selección múltiple por URL, SVG temporal y tabla de datos equivalente. El Elo visible, incluido el récord de pico, se redondea a enteros; los empates de valor visible comparten puesto. RED 3, GREEN 12/12, suite 242 aprobadas, 5 omitidas.
L7: T3 añadió `/comparar` para cualquier pareja y `/enciclopedia` con filtros combinables, resultados y descarga PGN solo cuando existe una secuencia legal de jugadas; los resultados sin planilla permanecen visibles. La primera prueba usó un torneo demo sin partidas y fue corregida para seleccionar un torneo con partidas.
L8: T4 cambió los overrides verdes a azul marino/blanco, adaptó el gráfico Elo al modo oscuro, añadió menú responsive y actualizó URL de entradas a `0.10.0-demo`. La suite detectó expectativas de caché de 0.9.3; se ajustaron solo las entradas nuevas y se preservó la cobertura de importaciones previas.

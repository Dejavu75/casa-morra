# Carga administrativa de partidas

Objetivo: permitir altas de resultados y completado posterior de jugadas sin duplicar estadísticas.
Rama: `feat/casa-morra-87-admin-partidas`. Entrega: rama local por unidades; publicación solo tras pruebas y revisión aplicable.
Pruebas: `node --test`, `npm run verify:data`; servidor local aislado y verificación HTTP.

## Specs

- **S1.** «Tiene que tener la posibilidad de cargar la partida. Manualmente o por pgn». Un administrador puede introducir jugadas manualmente o importar un PGN; las jugadas se validan y quedan asociadas a la partida.
- **S2.** «Solo admins». «Autenticación. Pero simple. Es una página de bajo riesgo y no hace falta grandes medidas». El acceso de escritura requiere autenticación administrativa sencilla. Supuesto de seguridad: panel solo en `127.0.0.1`; la web pública en LAN permanece de solo lectura.
- **S3.** «Se pueden hacer las dos cosas. Cargar nuevas o actualizar las existentes. Porque a veces primero tenés el resultado y luego a unos días a la partida entera». Se puede crear una partida con resultado y sin jugadas y luego completar la misma identidad con jugadas, sin sumar otro resultado. Las altas deben mantener consistentes las estadísticas y tablas del torneo.
- **S4.** «Todo el sitio debe estar en español pero preparado para múltiplelenguaje en el futuro. Documentación, repo y artefactos también». Interfaz y documentación en español; cadenas agrupadas para futura traducción.
- **S5.** «Por ahora solo Ajedrez». La carga se limita a partidas de ajedrez estándar.

## Tasks

- [x] **T1** (S1, S3, S5): dominio de jugadas manuales/PGN y transacción de alta/completado; ruta inline; RED observado en `test/admin-game.test.mjs`, `test/admin-game-store.test.mjs` y `test/game-replay.test.mjs`; GREEN 225/230, 5 omitidas; commit pendiente.
- [ ] **T2** (S2, S3): API y autenticación administrativa local, sin habilitar escritura pública; ruta inline; estado pendiente; commit pendiente.
- [ ] **T3** (S1-S4): panel administrativo en español, navegación y documentación; ruta inline; estado pendiente; commit pendiente.
- [ ] **T4** (S1-S5): pruebas integradas, Docker local y comprobación de no duplicación/seguridad; ruta inline con verificador independiente por riesgo 2 y 5; estado pendiente; commit pendiente.

## Log

- **L1, 2026-10-31.** «Tiene que tener la posibilidad de cargar la partida. Manualmente o por pgn».
- **L2, 2026-10-31.** «Solo admins».
- **L3, 2026-10-31.** «Autenticación. Pero simple. Es una página de bajo riesgo y no hace falta grandes medidas».
- **L4, 2026-10-31.** «Se pueden hacer las dos cosas. Cargar nuevas o actualizar las existentes. Porque a veces primero tenés el resultado y luego a unos días a la partida entera».
- **L5, 2026-10-31.** La estructura actual exige que las partidas de cada torneo concilien con puntos y W/D/L de su tabla. Una alta requiere transacción que actualice ambos; una corrección de jugadas no cambia el resultado. No se modificará el fixture demo comprometido ni se reutilizarán credenciales de otros sitios.
- **L6, 2026-10-31.** Pronóstico inicial: ~600-900 líneas entre dominio, servidor, UI y pruebas. Estrategia de entrega: `ask-on-risk`; una rama con commits de comportamiento revisables. La decisión de cadena se solicitará solo al superar el umbral antes del siguiente commit.
- **L7, 2026-10-31.** T1: `chess.js@1.4.0` valida SAN/PGN, se guardan jugadas UCI y el visor público reproduce cualquier secuencia legal. Alta y completado usan un evento auditado con CAS y reversión. La tabla demo se reordena por puntos, con orden anterior como desempate y puestos compartidos. `node --test` focalizado: 23/23; `npm test`: 225 aprobadas, 5 omitidas, 0 fallidas; `npm run verify:data`: 0 errores. Riesgo: ítems 1, 3 y 5; verificación independiente pendiente.
- **L8, 2026-10-31.** El verificador independiente detectó que un PGN `SetUp/FEN` perdía la posición inicial al guardar solo UCI y que una cabecera `Variant` se aceptaba aunque S5 limita el ajedrez estándar. Se agregaron pruebas RED para ambos y para hash del almacén invariable tras rechazo; GREEN 5/5 en las pruebas enfocadas. La corrección se limita a rechazar esas cabeceras; no se amplía el formato persistido.
- **L9, 2026-10-31.** RDD del commit T1, linaje `review-2926dcd550053d4e`, consentimiento `granted`: cuatro lentes hallaron un bloqueo reproducible `R3-pgn-variations-discarded`. Se rechazaron líneas alternativas `(...)` fuera de comentarios/cabeceras; pruebas RED → GREEN y hash sin cambios. Verificación posterior: `npm test` 227 aprobadas, 5 omitidas; `npm run verify:data` sin errores. Corrección acotada dentro de 70 líneas previstas; autoridad final pendiente.

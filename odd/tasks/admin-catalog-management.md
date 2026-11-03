# Gestión administrativa de estadísticas

Objetivo: completar la carga local de jugadores, torneos y registros relacionados sin perder datos existentes.
Rama: `feat/admin-catalog-management`; entrega: `exception-ok` (excepciones de tamaño autorizadas previamente); pruebas: `node --test`, `npm run verify:data`, Docker local.
Previsión: aproximadamente 900 líneas autorales; el trabajo se divide en unidades funcionales con pruebas y documentación.

## Specs

- **S1.** «avanza en modo goal con lo necesario para cargar jugadores, torneos y todo el resto.» El panel autenticado debe permitir altas de jugadores y torneos, y mantener la información estadística relacionada; se excluye contenido no estadístico.
- **S2.** «Solo admins» y «Autenticación. Pero simple. Es una página de bajo riesgo y no hace falta grandes medidas». Mantener la separación y autenticación local existentes; la web pública sigue siendo de solo lectura.
- **S3.** «Se pueden hacer las dos cosas. Cargar nuevas o actualizar las existentes. Porque a veces primero tenés el resultado y luego a unos días a la partida entera». Conservar altas de resultados y carga/corrección posterior de jugadas manuales o PGN; agregar mantenimiento no destructivo de datos existentes.
- **S4.** «Datos demo». Conservar los registros actuales y ofrecer carga progresiva de datos sin sobrescribir el almacén; las operaciones rechazadas no deben modificar estado privado ni exportación pública.
- **S5.** «Por ahora solo Ajedrez. Todo el sitio debe estar en español pero preparado para múltiplelenguaje en el futuro. Documentación, repo y artefactos también.» Las nuevas pantallas, errores, pruebas y documentación de operación se redactan en español profesional, sin introducir otros deportes.

## Tasks

- [x] **T1 — S1,S2,S4,S5 — inline:** alta y corrección descriptiva de jugadores; API, UI, pruebas, documentación. Riesgo: 1,3,4 por almacén auditado/CAS. RED `404 != 201`; GREEN `node --test test/admin-players.test.mjs`; verificación independiente PASS. Commit: `87c0613`; revisión RDD `review-55ebe7da22e65f0c` aprobada y reconocida.
- [x] **T2 — S1,S2,S4,S5 — inline:** alta y edición de temporadas, torneos, participantes y tabla inicial; permitir participantes sin partida con cero puntos. Riesgo: 1,3,4 por integridad oficial y datos persistidos. RED `UNEXPLAINED_STANDING`; GREEN 3/3 focales, 280/5 suite; verificación independiente PASS. Commit: pendiente.
- [ ] **T3 — S1,S3,S4,S5 — inline:** mantenimiento no destructivo de partidas/resultados, descansos y registros estadísticos restantes que el modelo soporte; pruebas de consistencia y UI. Riesgo: 1,3,4.
- [ ] **T4 — S1-S5 — inline:** verificar rutas, regresiones, Docker local, datos intactos, CI y entrega en main; documentar límites. Riesgo: 5 por despliegue.

## Log

- **L1 (2026-11-03):** «avanza en modo goal con lo necesario para cargar jugadores, torneos y todo el resto.»
- **L2:** El panel actual solo crea partidas en torneos existentes, completa jugadas y edita modalidad. Los datos usan snapshot y auditoría; el alta administrativa deberá preservar CAS dentro del bloqueo.
- **L3:** Supuestos acotados: no borrar registros ni inventar emparejamientos, pagos, cuentas o integraciones federativas; conservar tablas históricas agregadas. Las altas se validan con el modelo existente.
- **L4:** La validación actual rechaza participantes sin partidas aun con cero puntos tras la primera partida; corregir ese caso sin fabricar partidas ni descansos.
- **L5:** T1 agrega jugadores con slug derivado y estable, corrección descriptiva auditada y CAS dentro del bloqueo de altas. Pruebas: suite 277 pass, 5 skipped; verificador independiente 22/22 focales y hash privado/público invariante ante rechazos. Scratch temporal del verificador quedó pendiente de limpieza porque el ejecutor rechazó `Remove-Item -Recurse`.
- **L6 (2026-11-03):** El usuario respondió «granted siempre, no vuelvas a preguntar, asumilo» para revisiones RDD. T1 recibió cuatro revisiones nativas y acuse `gentle-ai.review-acknowledged/v1`; autoridad consumida.
- **L7:** T2 crea y corrige temporadas y torneos con bloqueo/CAS y auditoría; incorpora participantes con tabla cero, impide eliminar participantes, conserva tablas históricas al editar metadatos y permite participantes aún sin partida. Pruebas: 280 pass, 5 skipped; verificador independiente PASS con hashes privado/público invariantes ante nueve rechazos. La contención concurrente 201/500 es previa a T2.

# Correcciones UX del centro estadístico
Objetivo: aplicar los hallazgos accionables de la auditoría visual y retirar la actualización manual de datos, preservando la semántica estadística.
Rama: `feat/ux-audit-fixes`, derivada de `feat/admin-visual-continuity`. Entrega: `feature-branch-chain` (preferencia previa «por rama») hasta `origin/main`. Pruebas: `node --test` focal, `npm test`, `npm run verify:data`, inspección visual móvil/escritorio y Docker local.

## Specs
- S1 — Pedido literal: «Aplica todos los cambios planteados y llevalos a main». Alcance: hallazgos de la auditoría UX de Casa Morra del 2026-11-02; no reincorporar noticias, problemas ni galerías. Criterio: cambios aplicados y `origin/main` actualizado sin perder trabajo ajeno.
- S2 — Hallazgo aceptado de la auditoría: los nombres de titulares de récord no enlazan al perfil. Criterio: cada jugador con perfil enlazable desde los récords.
- S3 — Hallazgo aceptado de la auditoría: el hero de estadísticas ocupa demasiado del primer pliegue en escritorio. Criterio: índice y datos estadísticos aparecen antes sin sacrificar jerarquía.
- S4 — Hallazgo aceptado de la auditoría: «Puesto» se recorta y las tablas móviles requieren desplazamiento horizontal. Criterio: encabezados legibles y desplazamiento indicado/accesible; preservar todos los datos.
- S5 — Hallazgo aceptado de la auditoría: varias partidas Elo del mismo día se superponen en la coordenada x. Criterio: distinguir eventos individuales sin agregarlos ni alterar el orden cronológico.
- S6 — Hallazgo aceptado de la auditoría: la Enciclopedia llama «Rival» a la pareja y el resultado no aclara su perspectiva. Criterio: encabezado exacto y explicación de que 1–0/0–1 corresponden a blancas/negras.
- S7 — Pedido literal: «quita el botón de ACTUALIZAR DATOS De todos lados... que refresquen la página». Criterio: ningún botón público de actualización manual; recargar la página sigue cargando datos; conservar la actualización interna no visible del panel admin.

## Tasks
- [x] T1 (S2–S3) — Ruta inline: enlaces de récords y hero compacto con pruebas. Commit: ver L5. Riesgo: ninguno.
- [x] T2 (S4) — Ruta inline: legibilidad y affordance de tablas móviles con pruebas. Commit: ver L6. Riesgo: ninguno.
- [x] T3 (S5) — Ruta inline: distinguir puntos Elo del mismo día y probar secuencia. Commit: ver L7. Riesgo: ninguno.
- [x] T4 (S6) — Ruta inline: encabezado y perspectiva de resultados en Enciclopedia con pruebas. Commit: ver L8. Riesgo: ninguno.
- [x] T5 (S7) — Ruta inline: retirar control manual de actualización, mantener carga normal y actualizar pruebas. Commit: ver L4. Riesgo: ninguno.
- [ ] T6 (S1) — Ruta inline: ejecutar suite y aceptación local, publicar por PR o avance seguro a `origin/main` y verificar remoto. Commit de cierre pendiente. Riesgo: ítem 5 por entrega.

## Log
- L1 (2026-11-02) — «Aplica todos los cambios planteados y llevalos a main».
- L2 (2026-11-02) — «quita el botón de ACTUALIZAR DATOS De todos lados... que refresquen la página».
- L3 (2026-11-02) — La continuidad visual del admin ya está implementada en `b23c37a` y documentada en `78d2327`; esta rama contiene ambos commits. Los hallazgos S2–S6 proceden de la auditoría previa; se conservará la semántica de cada partida Elo, los resultados desde la perspectiva de blancas y los datos completos de las tablas. Estrategia inicial: `ask-on-risk`; previsión aproximada 300–450 líneas autorales, revisar antes de superar 400.
- L4 (2026-11-02) — T5: 3 pruebas RED antes de quitar el control, luego 21/21 focales GREEN. `npm test`: 250 aprobadas, 5 omitidas, 0 fallidas; `npm run verify:data`: 0 errores. Se preservó `source.refresh()` al iniciar y navegar; no quedan selectores ni texto del botón en `dist`. Commit `85d8c70f886626157430b6fab3a36b41db27820e`; RDD riesgo medio, `review_due=false`, motivo `under_budget` sobre la rama acumulada.
- L5 (2026-11-02) — T1: 2 pruebas RED y luego 15/15 focales GREEN. La suite completa pasó: 252 aprobadas, 5 omitidas. Se actualizó una prueba antigua que prohibía enlaces a perfiles pese a que esa ruta estadística ya está publicada. El hero reduce tamaño, espaciado y altura; aceptación visual pendiente del despliegue local. Commit `d708c2d67b505c27f5400accbceb51ee29989f55`; RDD riesgo medio, `under_budget` acumulado.
- L6 (2026-11-02) — T2: 2 pruebas RED y luego 17/17 focales GREEN. La suite completa pasó: 254 aprobadas, 5 omitidas. En el perfil, «Puesto» se colocó antes de «Fecha»; en perfiles, torneos y tabla anual hay pistas de desplazamiento y regiones enfocables. Verificación visual móvil pendiente del despliegue. Commit `c598f12a30ebf781e26c0a4d1dddbcb4958a0586`; RDD riesgo medio, `under_budget` acumulado.
- L7 (2026-11-02) — T3: prueba RED y luego 3/3 focales GREEN. La suite completa pasó: 255 aprobadas, 5 omitidas. El gráfico asigna una posición horizontal a cada partida elegible del mismo día y la tabla identifica la partida; no se agregan ni redondean internamente resultados nuevos. Verificación visual pendiente. Commit `93383d6d39d695ad8ac27f9b61bc65371e30c5a5`; RDD riesgo medio, `under_budget` acumulado.
- L8 (2026-11-02) — T4: prueba RED y luego 4/4 focales GREEN. La suite completa pasó: 256 aprobadas, 5 omitidas. Enciclopedia usa «Blancas — Negras» sin filtro y «Rival» con jugador seleccionado; Enciclopedia y comparación explican el resultado desde la perspectiva de las piezas. Commit `0df6c34d7b743f28e29d9a6d32108f7206d6b873`; RDD riesgo medio, `under_budget` acumulado.
- L9 (2026-11-02) — La primera captura de escritorio mostró la primera tabla debajo del pliegue (850 px en un alto de 720). Corrección acotada: se redujo hero y el hueco del estado de fuente, con 2 pruebas RED→GREEN y suite completa 256 aprobadas/5 omitidas. La segunda captura sitúa el índice a 521 px y la primera tabla a 687 px; móvil de 390 px sin desbordamiento horizontal. El acumulado ronda 415 líneas con correcciones pendientes: se reutiliza la preferencia previa «por rama» documentada como `feature-branch-chain` en `odd/tasks/admin-game-entry.md`.

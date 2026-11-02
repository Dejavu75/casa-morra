# Integración de Casa Morra en main remoto

Objetivo: publicar en `main` el sitio vigente de estadísticas y el panel admin sin recuperar páginas retiradas.
Rama: `feat/casa-morra-90-main-integration`. Entrega: fast-forward directo autorizado a `main`; no hay PR ni issues existentes. Pruebas: `npm test`, `npm run verify:data`, CI GitHub y comprobación del árbol remoto.

## Specs

- **S1.** «Cierra todas las ramas pendiente y pasa todo a main remoto. Autorizadas todos los pr, issues y etiquetas pendientes.» Integrar el trabajo vigente y cerrar referencias remotas supersedidas sin inventar PR o issues.
- **S2.** «Trabaja en modo goal hasta que todas las ramas estén en main remoto». Verificar que `main` remoto contiene el resultado y no quedan ramas pendientes.
- **S3.** «La página se va a centrar en estadística. Todo el resto no se usará. Ponele solo la parte de estadísticass». No reincorporar las páginas de las ramas antiguas 76 y 77.
- **S4.** «No hay host en otro lado aun. Sigue local la instalaci9n». No modificar el Docker local ni desplegar a otro anfitrión.

## Tasks

- [x] **T1** (S1, S3): incorporar las mejoras aún vigentes de las ramas 78 y 79 con pruebas; ruta inline, riesgo ítem 4 por orden asíncrono; RED 3/18, GREEN 18/18, verificador independiente PASS; commit `9b25fb2`.
- [x] **T2** (S1-S4): ejecutar suite, datos, verificador independiente y revisión nativa aplicable, sin tocar el Docker local; ruta inline con verificador; 240 aprobadas/5 omitidas, datos 0 errores, CI de rama exitosa y RDD aprobado/reconocido; commit `9b25fb2`.
- [x] **T3** (S1-S4): publicar el resultado en `main` por fast-forward, comprobar CI y reconciliar las ramas remotas y artefactos; ruta inline, riesgo ítem 5 por entrega; `main` en `9b25fb2`, CI `41426701088` exitosa, 82 ramas remotas cerradas, cero PR/issues que cerrar.

## Log

- **L1, 2026-11-02.** «Trabaja en modo goal hasta que todas las ramas estén en main remoto».
- **L2, 2026-11-02.** La petición de integración precisa el alcance: «Cierra todas las ramas pendiente y pasa todo a main remoto. Autorizadas todos los pr, issues y etiquetas pendientes.»
- **L3, 2026-11-02.** Auditoría read-only: `origin/main` es ancestro de rama 89; 82 ramas remotas, 78 ya contenidas en rama 89 y cuatro no contenidas (76–79). Las ramas 76/77 añaden perfil y portada fuera del alcance; 78 mejora el estado de recarga y 79 el grafo de caché, todavía pertinentes. GitHub tiene cero PR/issues, `main` sin protección ni rulesets y CI solo verifica sin publicar. La diferencia acumulada de rama 89 es 14.289 líneas autorales; se conserva la excepción de tamaño autorizada. No se tocará el despliegue local.
- **L4, 2026-11-02.** Se creó la rama 90 desde `218f04a` para integrar sin alterar la rama 89.
- **L5, 2026-11-02.** T1: los tres casos nuevos fallaron antes del cambio (RED), luego 18/18 pasaron. `npm test`: 240 aprobadas, 5 omitidas; `npm run verify:data`: 0 errores; `git diff --check`: sin problemas. Verificador independiente: baseline 16/16, candidato 18/18, respuesta 404 sin mutación del fixture, salida anterior idéntica, S1/S3 PASS; spot check 18/18. El scratch `C:\Users\diego\AppData\Local\Temp\casa-morra-t1.yUualS` quedó conservado porque su eliminación recursiva fue denegada por política. No se modificó Docker.
- **L6, 2026-11-02.** El usuario respondió `granted` al candidato `sha256:4c60dab0ade40f1c0e30e52e5fd24e05ea2916cdb2c4e38286133f37abbf8b91`. Revisión RDD de resiliencia y confiabilidad sin hallazgos, reconocida y consumida como `review-34060c2dbd4ecb39`. Verificación independiente prepublicación: S3 PASS; el preflight remoto confirmó tip `main` `8fee2ae`, rama 90 `9b25fb2`, CI `41425522008` exitosa, cero PR/issues abiertos y ausencia de reglas de protección. `test/stats-only-site.test.mjs`: 3/3.
- **L7, 2026-11-02.** `git push origin HEAD:refs/heads/main` avanzó `main` sin fuerza de `8fee2ae` a `9b25fb2`; la CI de `main` `41426701088` terminó exitosa. Las 82 ramas remotas `feat/casa-morra*` se eliminaron después de confirmar su inventario: 78 commits ancestrales y cuatro ramas no ancestrales; `2b4a759` y `f878d7e` quedaron fuera por el alcance solo estadísticas, y los cambios útiles de `5cbc184` y `2551a26` fueron integrados selectivamente. `git ls-remote --heads origin` devolvió solo `main`. GitHub no tenía PR ni issues existentes ni etiquetas pendientes de aplicación. No se modificó el Docker local.

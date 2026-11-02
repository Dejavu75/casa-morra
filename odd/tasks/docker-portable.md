# Casa Morra portable en Docker

Objetivo: conservar la web estadística y el panel admin actuales y permitir instalarlos de forma verificable en otro host Docker.
Rama: `feat/casa-morra-88-docker-portable`. Entrega: `feature-branch-chain`, sin Sites ni cambios al servicio habitual hasta comprobarlos.
Pruebas: `npm test`, `npm run verify:data`, configuración Compose, arranque aislado y comprobaciones HTTP.

## Specs

- **S1.** «no vayas a sites mejoperdon. No quiero ir a sites no mas». No usar Sites ni migrar la web o el panel.
- **S2.** «Quiero que el modo goal sea terminar todo lo necesario en la página para seguir con un docker en otro lado». Preparar y verificar una instalación reproducible en otro host Docker sin asumir su IP ni sistema operativo.
- **S3.** «Habilita el modo goal con Todo lo que dije antes de no detenerte y las preguntas pero para terminar la página. No para migrar a sites». Mantener el alcance estadístico, los datos demo, el panel admin y las decisiones previas sin ampliar el producto.
- **S4.** «si te bloqueas con algo no pares, hacé la pregunta mientras seguis con otra cosa para que te conteste y vayas mezclando». Preguntar solo decisiones reales y avanzar las unidades independientes.
- **S5.** «Solo admins». «Autenticación. Pero simple. Es una página de bajo riesgo y no hace falta grandes medidas». El admin sigue protegido y no se expone a la LAN por omisión.
- **S6.** «Todo el sitio debe estar en español pero preparado para múltiplelenguaje en el futuro. Documentación, repo y artefactos también». Mantener documentación y artefactos en español neutral.

## Tasks

- [x] **T1** (S2, S5): quitar la IP LAN fija del Compose opcional con configuración explícita por host, sin cambiar el enlace habitual actual; ruta inline; RED 2 pruebas de Compose, GREEN 4/4 tras corrección RDD, suite 231 aprobadas/5 omitidas antes de T2, datos sin errores, verificador independiente PASS; commit `927116c`, RDD aprobado y reconocido.
- [x] **T2** (S2, S3, S5-S6): preparar instrucciones y comprobaciones de instalación, datos demo, respaldo/traslado y secreto admin para Windows y Linux; ruta inline; RED 4 pruebas, GREEN 5/5, suite 236 aprobadas/5 omitidas, datos sin errores, verificador independiente PASS y spot check PASS; commit pendiente.
- [ ] **T3** (S2-S4): ejecutar build y aceptación Docker aislada con IP/puerto alternativos, sin modificar el despliegue habitual; ruta inline con verificador independiente por riesgo de entorno; commit pendiente.
- [ ] **T4** (S2-S4, S6): publicar rama e imágenes versionadas, verificar CI exacto y registrar límites de QA y segundo host; ruta inline; commit pendiente.

## Log

- **L1, 2026-11-01.** «no vayas a sites mejoperdon. No quiero ir a sites no mas. Quiero que el modo goal sea terminar todo lo necesario en la página para seguir con un docker en otro lado. Habilita el modo goal con Todo lo que dije antes de no detenerte y las preguntas pero para terminar la página. No para migrar a sites».
- **L2, 2026-11-01.** Se pausó y luego se cerró el objetivo de Sites a pedido del usuario; no hubo publicación. Este trabajo no ejecutará herramientas Sites. La rama de preparación anterior no tenía commits; se reutilizó como `feat/casa-morra-88-docker-portable` y se retiró su ficha no comprometida.
- **L3, 2026-11-01.** Exploración de solo lectura: `compose.lan.yaml` codifica `192.168.0.52`; `.demo-state/` y `.demo-public/` son bind mounts externos a la imagen; `.env` contiene el secreto admin local y está ignorado por Git. Pronóstico inicial: menos de 400 líneas autorales. El despliegue habitual no se recreará durante la implementación. No se conoce aún el host destino; la comprobación en un segundo host queda pendiente de sus datos/acceso.
- **L4, 2026-11-01.** T1: `CASA_MORRA_LAN_IP` obligatorio para `compose.lan.yaml`, con fallo cerrado si falta o está vacío; el Compose base sigue en loopback. La IP habitual se añadió solo al `.env` local ignorado por Git para conservar el siguiente arranque en `192.168.0.52`. Dos casos RED antes de implementar, GREEN 3/3. `npm test`: 230 aprobadas, 5 omitidas; `npm run verify:data`: 0 errores; configuración combinada habitual válida. Verificador independiente T1 PASS: IP alternativa, valor vacío/ausente, diferencia baseline/candidato de variantes base y host idéntica, hashes de almacén/exportación invariantes. El borrado de su scratch temporal fue denegado por política; queda conservado. Riesgo: ítem 5 (configuración de entrega).
- **L5, 2026-11-01.** RDD T1 detectó que `0.0.0.0` y `::` podían pasar la interpolación. Se agregó `scripts/compose-lan.mjs`, que valida el bind efectivo antes de activar; pruebas 4/4. Commit corregido `927116c`. Revisión de recuperación `review-bb82a4c229852b96` aprobada y reconocida; autoridad consumida. El test T2 aún RED provocó cuatro fallos temporales en `npm test`; la suite T1 aislada pasó 231/5.
- **L6, 2026-11-01.** T2: bootstrap idempotente de `.demo-state/admin.json` y `.demo-public/snapshot.json`, usando validadores existentes, con rechazo no mutante de exportación huérfana, inválida o distinta. Servicio Compose de preparación sin red, puertos ni contraseña; guía de Windows/Linux y traslado. `npm test`: 236 aprobadas, 5 omitidas; `npm run verify:data`: 0 errores. Verificador independiente y spot check PASS para hashes, baseline diferencial y Compose. No se probaron aún contenedores ni UID Linux; corresponden a T3. Riesgo: ítem 5 (entorno Docker).

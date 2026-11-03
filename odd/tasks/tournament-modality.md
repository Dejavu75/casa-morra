# Modalidad y fecha breve de torneos

Objetivo: mostrar la fecha breve y permitir cargar una modalidad de texto por torneo existente.
Rama: `feat/ux-audit-fixes`. Entrega: `ask-on-risk`; un cambio cohesivo con pruebas y documentación. Runner: `npm test` y `npm run verify:data`.

## Specs

- S1. «En los torneos "3 de octubre de 2026 · 5 participantes · 5 rondas" poné la fecha en formato 03/10/2026 y dale lugar a la modalidad.» Criterio: la lista y el detalle muestran `dd/mm/aaaa`, conservando la fecha ISO en datos y ordenación; muestran la modalidad junto a los metadatos cuando existe, sin espacio vacío cuando falta.
- S2. «20'+3 etcs...  Poné un campo de texto para cargar la modalidad». Criterio: el panel autenticado permite editar texto libre opcional de cualquier torneo existente, incluido uno histórico; el servidor valida y persiste sólo ese campo, publica el snapshot, y preserva juegos/tablas/orden y snapshots anteriores sin modalidad.

## Tasks

- T1 [S1-S2] inline — esquema opcional, render público, endpoint/admin, pruebas y documentación; completo en `d27e825`, RDD aprobado y acusado. Ruta: inline; un comportamiento cohesivo sin unidades independientes para escritor paralelo. Riesgo: ítems 1, 3 y 4 por contrato persistido y CAS.
- T2 [S1-S2] odd-verify — comprobación independiente de invariantes; verificado (13/13 pruebas en copia aislada, sin bloqueadores); sin commit propio.

## Log

- L1 (2026-11-03): «En los torneos "3 de octubre de 2026 · 5 participantes · 5 rondas" poné la fecha en formato 03/10/2026 y dale lugar a la modalidad.
20'+3 etcs...  Poné un campo de texto para cargar la modalidad».
- L2: El esquema actual de torneos no tiene modalidad; ambos validadores exigen campos exactos. Se usará un campo opcional que no altera snapshots históricos, y la corrección auditada existente para editar sólo metadatos.
- L3: RED observado: 0/3 pruebas nuevas; GREEN: 4/4. Suite completa: 274 aprobadas, 0 fallidas, 5 omitidas; `npm run verify:data` válido. Verificador independiente: S1/S2 aprobadas, hash canónico previo preservado, rechazo no mutante, auditoría y rollback comprobados. Contención simultánea devuelve 500 en el comportamiento base de partidas también; se registra como observación previa, no se amplía el alcance.
- L4: Despliegue local con `docker compose -p casa-morra` de web y admin; HTTP 8088 y 8090 responden, hashes de almacén y exportación permanecen intactos. No se cargó una modalidad de ejemplo sin asignación elegida por el usuario. Cambios anteriores de compactación permanecían sin commit en la misma rama y comparten `admin/index.html` y `dist/views/common.js`; el commit de este trabajo sigue pendiente para no mezclar unidades sin preparar el índice selectivamente.
- L5: Revisión RDD del candidato `sha256:7210d5ca19053364893e6c707210e0c26eeac1a65f841d14529a62e01790eb2c` aprobada por cuatro lentes y acusada con `gentle-ai.review-acknowledged/v1`, lineage `review-a727e62171165c43`. El `invalid_request` intermedio se debió a un identificador `repository-context` mal copiado en el resumen, no a un defecto confirmado del proveedor. La entrega Git sigue separada del acuse.
- L6: Unidad consolidada en `d27e825` junto a la compactación visual y previsualización pública preexistentes en la rama; excepción de tamaño autorizada previamente por el usuario. Suite repetida: 274 aprobadas, 0 fallidas, 5 omitidas; prueba de modalidad 4/4.
- L7: Tras publicar en `main`, CI detectó tres asunciones locales en pruebas. `8ccffa4` eliminó la dependencia del archivo `.demo-public/snapshot.json` y separó la semántica de los montajes TLS de la normalización de Docker Compose; `17db7cc` derivó la versión de `app.js` del HTML distribuido. Ambas correcciones tuvieron verificación independiente y revisión RDD aprobada y acusada. El run `41656965594` de GitHub concluyó correctamente en `main`; el espejo Engram se recuperó.

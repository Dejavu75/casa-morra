# Continuidad visual del panel administrativo
Objetivo: armonizar la interfaz administrativa con la web estadística pública sin modificar autenticación, datos ni flujos.
Rama: `feat/admin-visual-continuity`. Entrega: rama local; publicación remota no solicitada. Pruebas: `node --test test/admin-visual-continuity.test.mjs` y `npm test`; aceptación visual móvil/escritorio y Docker local.

## Specs
- S1 — Pedido literal: «arregla la continuidad visual». Alcance interpretado desde la auditoría anterior: alinear la paleta, tipografía de marca, bordes y controles del panel administrativo con la web pública de Casa Morra. No cambiar textos funcionales, campos, rutas, credenciales ni persistencia. Comprobar HTML/CSS, pruebas y capturas móvil/escritorio.

## Tasks
- [x] T1 (S1) — Ruta inline: ajustar marca y estilos del administrador; añadir prueba de regresión visual estructural; verificar pruebas y vista local. Commit: ver L4. Riesgo: ítem 5 por reconstrucción del Docker local.

## Log
- L1 (2026-11-02) — «arregla la continuidad visual».
- L2 (2026-11-02) — Evidencia: la auditoría de la ruta administrativa anónima mostró verde y beige, mientras la web pública usa azul marino y blanco. Se limita la corrección al panel administrativo; no se altera comportamiento.
- L3 (2026-11-02) — Se observaron 2 pruebas RED antes del cambio y 2 GREEN después. `npm test`: 250 aprobadas, 5 omitidas, 0 fallidas; `npm run verify:data`: 0 errores. Prueba focal combinada posterior a la verificación independiente: 4/4. Docker admin reconstruido y sano; web pública sana; hashes de los dos almacenes demo sin cambios. Capturas visuales de escritorio y móvil (390 px) verificadas; en móvil no hay desbordamiento horizontal (`scrollWidth = 390`). Se restauró el tamaño normal del navegador.
- L4 (2026-11-02) — Implementación y pruebas en `b23c37abd32cccd9dec7cbf5f3db86f4413b1ba9`. Evaluación RDD: riesgo medio, `review_due=false`, motivo `under_budget`; sin revisión iniciada ni autoridad de entrega. La rama sigue local y no se publicó remotamente.

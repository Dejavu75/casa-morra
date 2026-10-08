# Despacho de vistas de demostración

`renderRoute(route, data, options)` transforma una ruta analizada por `parseRoute` en `{ title, html }`. La función no lee ni modifica el navegador: recibe los datos y el catálogo por parámetros, de modo que las quince rutas públicas pueden verificarse sin iniciar un servidor.

El idioma publicado es español. Un catálogo futuro puede reemplazar textos de cada vista mediante `options.locale` y `options.catalogs`; las claves ausentes conservan el texto español. Los datos, identificadores y enlaces no se traducen. Una ruta desconocida devuelve una página segura con enlace al inicio, sin reflejar el identificador solicitado.

`dist/index.html` carga el shell público en español. Al iniciar en el navegador, `app.js` traduce sus etiquetas, renderiza la ruta actual, establece título y enlace activo, y adjunta el visor o el problema según corresponda. Los enlaces internos sin modificadores usan el historial del navegador; enlaces externos, descargas y apertura en otra pestaña conservan su comportamiento nativo. Al volver o avanzar, la vista se actualiza y recibe el foco. El menú y el tema ofrecen controles accesibles; el tema persiste si el almacenamiento está disponible.

Este corte no incluye servidor ni configuración Docker. Las pruebas de Node comprueban contratos y composición estática; no sustituyen una prueba visual o de teclado en un navegador real.

Comprobación focalizada: `node --test test/shell-dispatcher.test.mjs test/shell-integration.test.mjs test/puzzle-integration.test.mjs test/visual-i18n.test.mjs test/a11y-remediation.test.mjs`.

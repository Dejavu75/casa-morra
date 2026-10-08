# Despacho de vistas de demostración

`renderRoute(route, data, options)` transforma una ruta analizada por `parseRoute` en `{ title, html }`. La función no lee ni modifica el navegador: recibe los datos y el catálogo por parámetros, de modo que las quince rutas públicas pueden verificarse sin iniciar un servidor.

El idioma publicado es español. Un catálogo futuro puede reemplazar textos de cada vista mediante `options.locale` y `options.catalogs`; las claves ausentes conservan el texto español. Los datos, identificadores y enlaces no se traducen. Una ruta desconocida devuelve una página segura con enlace al inicio, sin reflejar el identificador solicitado.

Este módulo todavía **no** instala navegación, eventos, tema ni actualización del documento. La conexión con el HTML y el navegador pertenece a la siguiente unidad de trabajo.

Comprobación focalizada: `node --test test/shell-dispatcher.test.mjs`.

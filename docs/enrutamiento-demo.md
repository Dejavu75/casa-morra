# Despacho de vistas de demostración

`renderRoute(route, data, options)` transforma una ruta analizada por `parseRoute` en `{ title, html }`. La función no lee ni modifica el navegador: recibe los datos y el catálogo por parámetros, de modo que las quince rutas públicas pueden verificarse sin iniciar un servidor.

El idioma publicado es español. Un catálogo futuro puede reemplazar textos de cada vista mediante `options.locale` y `options.catalogs`; las claves ausentes conservan el texto español. El mismo contexto lleva el idioma a los formateadores `Intl.DateTimeFormat` y `Intl.NumberFormat`, y los mensajes al problema y al visor interactivos. Por ejemplo, una prueba puede inyectar `en` y solicitar `en-US` sin publicar un selector de idioma ni un catálogo inglés completo. Un idioma sin catálogo cae a textos y formatos `es-AR`. Una ruta desconocida devuelve una página segura con enlace al inicio, sin reflejar el identificador solicitado.

**Límite de datos:** nombres, noticias, descripción del club, clases, reconocimientos, temporadas, identificadores y enlaces pertenecen al fixture ficticio y no se traducen automáticamente. Una expansión multilingüe necesitará variantes editoriales verificadas y una política de búsqueda/orden alfabético por idioma. El HTML inicial sin JavaScript y los mensajes de errores de las herramientas operativas siguen en español; este cambio prepara las vistas dinámicas, no entrega todavía una experiencia completa en otro idioma.

`dist/index.html` carga el shell público en español. Al iniciar en el navegador, `app.js` traduce sus etiquetas, renderiza la ruta actual, establece título y enlace activo, y adjunta el visor o el problema según corresponda. Los enlaces internos sin modificadores usan el historial del navegador; enlaces externos, descargas y apertura en otra pestaña conservan su comportamiento nativo. Al volver o avanzar, la vista se actualiza y recibe el foco. El menú y el tema ofrecen controles accesibles; el tema persiste si el almacenamiento está disponible.

Las pruebas de Node comprueban contratos y composición estática; no sustituyen una prueba visual o de teclado en un navegador real. La aplicación se entrega además con Docker, pero la publicación y la aceptación en navegador se controlan por separado.

Comprobación focalizada: `node --test test/locale-context.test.mjs test/shell-dispatcher.test.mjs test/puzzle-integration.test.mjs`.

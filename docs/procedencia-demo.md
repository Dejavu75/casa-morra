# Procedencia de los datos y recursos de demostración

Casa Morra usa identidades, torneos, resultados y textos ficticios creados para esta demostración. No presenta esas cifras como datos de un club real. Las reglas de cálculo propias están en el [reglamento demo](reglamento-demo.md).

## Artefactos verificables

Estos SHA-256 identifican los bytes **de esta revisión**. `node --test test/provenance.test.mjs` comprueba que el documento y los archivos coincidan; si un recurso cambia, hay que revisar su procedencia y actualizar la tabla y la prueba en el mismo cambio.

| Archivo | SHA-256 | Procedencia |
|---|---|---|
| `dist/data/demo.js` | `321C96B848642A63FE59CE0210FAB1054DC796B6949FDC24843539C2BA4345F6` | Fixture ficticio creado para Casa Morra. |
| `dist/assets/hero-ajedrez.png` | `17FD0E195F23D3E83E463880899EBE99ACC931B7E948F1CFCD4E33774614E11F` | Imagen generada para el proyecto con una herramienta de OpenAI. |
| `dist/assets/galeria-estudio.png` | `6F4879D1DC92FBD354C14DB0F7D971EFB4538C99889CBD661C3F619801103429` | Imagen generada para el proyecto con una herramienta de OpenAI. |
| `dist/assets/galeria-sala.png` | `7AA62F2D1CA5233418E1C95B66F9DBB75375740A6B844AC677F996FE0D9FB36D` | Imagen generada para el proyecto con una herramienta de OpenAI. |

Se cotejaron los tres PNG con los archivos originales de la generación local: cada par fue idéntico byte por byte. No se incluyen en el repositorio los archivos de trabajo ni rutas locales. Esa coincidencia establece la procedencia de los **bytes**, no demuestra por sí sola titularidad de derechos, originalidad absoluta ni ausencia de infracción.

## Alcance de la inspección

El 8 de octubre de 2026 se hizo una **comparación acotada** con las páginas públicas de portada, jugadores, torneos, noticias, club y clases del sitio de referencia. No se observaron coincidencias exactas de los seis nombres de jugadores, los seis nombres de torneos, el nombre del club ni los dos títulos de noticias del fixture. Las tres imágenes muestran espacios genéricos de ajedrez, no personas o instalaciones identificadas del sitio de referencia. Esto **no prueba** que no existan coincidencias en otras páginas, material no público o fuentes externas, ni sustituye una revisión de derechos de uso.

## Privacidad y límites

- El fixture público no necesita cuentas, credenciales ni datos personales reales. El estado local `.demo-state/` y la exportación `.demo-public/` no forman parte del historial Git ni del contexto de construcción Docker.
- Una inspección heurística del contenido rastreado y del historial no encontró patrones de contraseñas, claves privadas, tokens, direcciones de correo o teléfonos en archivos del sitio. No equivale a una garantía de ausencia de secretos ni a una auditoría legal.
- **Los metadatos de Git sí contienen una dirección corporativa no anónima de autor en al menos 52 commits observados antes de esta revisión.** Por eso no se afirma que el repositorio público esté libre de información personal. Este documento no reproduce esa dirección y no modifica ni reescribe el historial.

Antes de incorporar datos o imágenes nuevos, comprobar consentimiento, procedencia y derechos aplicables; no reutilizar por defecto contenido de otro club. La publicación de este manifiesto no habilita cuentas ni carga de datos personales.

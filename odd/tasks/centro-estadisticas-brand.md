# Marca Centro de estadísticas
Objetivo: reemplazar la identidad pública y administrativa de Casa Morra por la marca elegida, sin alterar datos ni contratos internos.
Rama: feat/ux-audit-fixes. Entrega: ask-on-risk, sin push automático. Runner: node --test, npm test y verificación visual en Docker local.

## Specs
- S1. Pedido literal: «Vamos a cambiar el nombre, de casa morra a "Centro de estadísticas" y el CM del logo se tiene que transformar en un logo de una torre mezclada con un grafico de barras.» Aceptación: el nombre visible, accesible y en títulos de las rutas activas es Centro de estadísticas; no queda CM visible.
- S2. Selección y ajuste literal: «Quiero la 2 con un pequeño cambio. Para imágenes grandes las barras del centro tienen que estar coloreadas con los 3 colores, siendo el rojo el primero mas bajo. Para imagenes chicas la torre con el centro en negativo». Aceptación: variante grande con barras ascendentes roja, azul y dorada; variante pequeña con tres huecos transparentes en la torre, usada en cabeceras y favicon. Colores azul/dorado son una decisión de diseño para la paleta existente.
- S3. Alcance: conservar IDs, slugs, formatos de datos, cookie, variables Compose, datos históricos y el acceso administrativo existente. Aceptación: pruebas de datos y administración sin cambios funcionales; hashes de datos persistidos antes/después del despliegue iguales.

## Tasks
- T1 [S1-S3] inline; implementado y probado; copiar variantes elegidas, actualizar marca pública y admin, pruebas y procedencia; commit pendiente.
- T2 [S1-S3] inline; verificado en Docker local; verificar visualmente desktop/móvil, claro/oscuro y favicon; desplegar web y admin local sin tocar datos; commit/evidencia pendiente.

## Log
- L1. Usuario: «Vamos a cambiar el nombre, de casa morra a "Centro de estadísticas" y el CM del logo se tiene que transformar en un logo de una torre mezclada con un grafico de barras. Por ahi las barras pueden formar las partes de la torre o algo así. Presnetá 5 opciones de logos que pasen el lente de un experto en UX/UI».
- L2. Usuario: «Quiero la 2 con un pequeño cambio. Para imágenes grandes las barras del centro tienen que estar coloreadas con los 3 colores, siendo el rojo el primero mas bajo. Para imagenes chicas la torre con el centro en negativo».
- L3. Diseño: opción 2 original para pequeño; variante editada con barras roja, azul y dorada para grande. El sitio actual usa azul marino, azul y acento cálido. Pronóstico de fuente/pruebas/documentación: 250-400 líneas; los PNG generados no cuentan como líneas. La petición administrativa posterior se ejecuta como configuración separada y no se registra aquí con su valor secreto.
- L4. Pruebas: RED inicial de identidad (2 fallos), GREEN posterior; `npm test`: 268 aprobadas, 5 omitidas, 0 fallidas; `npm run verify:data`: 6 jugadores, 6 torneos, 70 partidas y 5 descansos. Verificación independiente: pruebas de administración, identidad y favicon 5/5; rutas públicas/admin 200; anónimo 401; CSP limitado a `img-src 'self'`; hashes de los dos archivos persistidos sin cambios.
- L5. Despliegue local: web reconstruida y publicada en `192.168.0.52:8088`; admin reconstruido en `127.0.0.1:8090`. Ambas rutas e imágenes responden 200. La primera recreación de web usando solo `compose.yaml` restauró temporalmente el bind a loopback; se corrigió inmediatamente combinando `compose.yaml` y `compose.lan.yaml`. La inspección visual pública de escritorio claro/oscuro y móvil, y admin de escritorio, no mostró recortes del logo o del nombre. La fuente sigue con cambios GEP previos sin commit: separar staging de marca para no mezclarlos.

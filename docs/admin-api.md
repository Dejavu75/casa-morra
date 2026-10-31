# Contrato HTTP administrativo local

El servicio administrativo es **separado** del Nginx público. Solo debe exponerse en `127.0.0.1`; el contenedor puede escuchar internamente en `0.0.0.0` únicamente cuando Docker publica el puerto en el loopback del host. Todas las respuestas usan `Cache-Control: no-store`. No se habilita escritura en el puerto público `8088`.

| Método y ruta | Entrada | Respuesta | Efecto |
| --- | --- | --- | --- |
| `POST /api/login` | `{ "password": "…" }` | `200` y cookie `HttpOnly; SameSite=Strict` | Crea una sesión temporal. |
| `POST /api/logout` | Cookie administrativa | `204` | Cierra la sesión. |
| `GET /api/state` | Cookie administrativa | `200` con `sha256`, `players`, `tournaments`, `games` | Solo lectura del estado demo vigente. |
| `POST /api/games` | Cookie, `Origin` local, `{ "expectedSha": "…", "game": {…}, "format"?: "manual"|"pgn", "text"?: "…" }` | `201` con `sha256` y `published` | Registra una partida y concilia su tabla. `text` omitido deja las jugadas pendientes. |
| `PUT /api/games/{id}/moves` | Cookie, `Origin` local, `{ "expectedSha": "…", "format": "manual"|"pgn", "text": "…" }` | `200` con `sha256` y `published` | Agrega o reemplaza jugadas sin sumar otro resultado. |
| `POST /api/publish` | Cookie, `Origin` local | `200` con `sha256` | Reintenta exportar el snapshot público después de un fallo. |
| `GET /health` | Ninguna | `200` | Comprueba proceso, no autentica ni revela datos. |

Los cambios requieren el hash leído en `/api/state`; un hash obsoleto o ID duplicado responde `409` sin escribir. Entradas inválidas responden `400`, ausencia de sesión `401`, origen incorrecto `403`. Si el almacén se guardó pero la exportación pública falló, la respuesta usa `202` con `published:false`; no se repite el alta y el administrador usa `/api/publish` para reconciliar. La cookie es una capacidad local, no debe enviarse ni exponerse en la web pública.

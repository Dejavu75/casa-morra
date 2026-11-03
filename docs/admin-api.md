# Contrato HTTP administrativo local

El servicio administrativo es **separado** del Nginx público. Solo debe exponerse en `127.0.0.1`; el contenedor puede escuchar internamente en `0.0.0.0` únicamente cuando Docker publica el puerto en el loopback del host. Todas las respuestas usan `Cache-Control: no-store`. No se habilita escritura en el puerto público `8088`.

| Método y ruta | Entrada | Respuesta | Efecto |
| --- | --- | --- | --- |
| `POST /api/login` | `{ "password": "…" }` | `200` y cookie `HttpOnly; SameSite=Strict` | Crea una sesión temporal. |
| `POST /api/logout` | Cookie administrativa | `204` | Cierra la sesión. |
| `GET /api/state` | Cookie administrativa | `200` con `sha256`, `players`, `seasons`, `tournaments`, `games`, `byes`, `titles` | Solo lectura del estado vigente. |
| `POST /api/players` | Cookie, `Origin` local, `{ "expectedSha": "…", "name": "María Pérez", "membership": "socia" }` | `201` con `id`, `sha256` y `published` | Agrega un jugador sin alterar los registros previos; el slug se deriva del nombre y no se modifica después. |
| `PUT /api/players/{id}` | Cookie, `Origin` local, mismo cuerpo | `200` con `id`, `sha256` y `published` | Corrige nombre y condición de un jugador existente conservando su identidad y URL. |
| `POST /api/seasons` | Cookie, `Origin` local, `{ "expectedSha": "…", "label": "2027–2028", "start": "2027-08-01", "end": "2028-07-31" }` | `201` con `id`, `sha256` y `published` | Agrega una temporada. |
| `PUT /api/seasons/{id}` | Cookie, `Origin` local, mismo cuerpo | `200` con `id`, `sha256` y `published` | Corrige nombre y fechas sin cambiar su identidad. |
| `POST /api/tournaments` | Cookie, `Origin` local, `{ "expectedSha": "…", "name": "Nuevo torneo", "seasonId": "…", "date": "2027-09-01", "type": "interno", "format": "round-robin", "modality": "20'+3", "annualEligible": true, "eloEligible": true, "playerIds": ["…", "…"] }` | `201` con `id`, `sha256` y `published` | Agrega torneo y tabla inicial de participantes con cero puntos y resultados. |
| `PUT /api/tournaments/{id}` | Cookie, `Origin` local, mismo cuerpo | `200` con `id`, `sha256` y `published` | Corrige metadatos y añade participantes; no permite quitar participantes existentes ni alterar una tabla histórica incompleta. |
| `POST /api/games` | Cookie, `Origin` local, `{ "expectedSha": "…", "game": {…}, "format"?: "manual"|"pgn", "text"?: "…" }` | `201` con `sha256` y `published` | Registra una partida y concilia su tabla. `text` omitido deja las jugadas pendientes. |
| `PUT /api/games/{id}` | Cookie, `Origin` local, `{ "expectedSha": "…", "result": "1/2-1/2", "date": "2027-09-01", "round": 2 }` | `200` con `sha256` y `published` | Corrige resultado, fecha o ronda; conserva jugadores, identidad y jugadas, y ajusta ambos renglones de la tabla. |
| `PUT /api/games/{id}/moves` | Cookie, `Origin` local, `{ "expectedSha": "…", "format": "manual"|"pgn", "text": "…" }` | `200` con `sha256` y `published` | Agrega o reemplaza jugadas sin sumar otro resultado. |
| `POST /api/byes` | Cookie, `Origin` local, `{ "expectedSha": "…", "tournamentId": "…", "playerId": "…", "round": 2, "points": 1 }` | `201` con `id`, `sha256` y `published` | Registra descanso y ajusta solo puntos de la tabla, no victorias ni empates. |
| `PUT /api/byes/{id}` | Cookie, `Origin` local, mismo cuerpo | `200` con `id`, `sha256` y `published` | Corrige ronda o puntos del descanso sin cambiar jugador ni torneo. |
| `POST /api/titles` | Cookie, `Origin` local, `{ "expectedSha": "…", "playerId": "…", "tournamentId": "…", "kind": "campeonato-club", "label": "Campeón" }` | `201` con `id`, `sha256` y `published` | Registra un título estadístico. |
| `PUT /api/titles/{id}` | Cookie, `Origin` local, mismo cuerpo | `200` con `id`, `sha256` y `published` | Corrige el título sin cambiar su identidad. |
| `PUT /api/tournaments/{id}/standings/{playerId}` | Cookie, `Origin` local, `{ "expectedSha": "…", "points": 3.5, "rank": 2 }` | `200` con `sha256` y `published` | Corrige la fila oficial solo en torneos sin partidas individuales; no inventa resultados. |
| `PUT /api/tournaments/{id}/modality` | Cookie, `Origin` local, `{ "expectedSha": "…", "modality": "20'+3" }` | `200` con `sha256` y `published` | Cambia solo la modalidad descriptiva de un torneo existente. Texto libre de una línea y hasta 80 caracteres; cadena vacía quita el campo. |
| `POST /api/publish` | Cookie, `Origin` local | `200` con `sha256` | Reintenta exportar el snapshot público después de un fallo. |
| `GET /health` | Ninguna | `200` | Comprueba proceso, no autentica ni revela datos. |

Los cambios requieren el hash leído en `/api/state`; un hash obsoleto o ID duplicado responde `409` sin escribir. Entradas inválidas responden `400`, ausencia de sesión `401`, origen incorrecto `403`. Si el almacén se guardó pero la exportación pública falló, la respuesta usa `202` con `published:false`; no se repite el alta y el administrador usa `/api/publish` para reconciliar. La cookie es una capacidad local, no debe enviarse ni exponerse en la web pública.

La modalidad no interpreta controles de tiempo ni altera resultados. El panel permite editarla en todos los torneos existentes, incluso si no admiten carga de partidas por tener una tabla histórica incompleta. La operación usa corrección auditada con CAS; no modifica la fecha ISO, la tabla, las partidas ni los descansos. Un torneo desconocido responde `404`.

El alta de torneos requiere al menos dos jugadores existentes. Su tabla inicial no inventa partidas: cada participante comienza con cero puntos, cero victorias, cero empates y cero derrotas. Al incorporar participantes a un torneo que ya tiene partidas, los que todavía no jugaron pueden permanecer en cero. Las identidades y rutas públicas existentes se conservan al corregir nombres; no se admiten eliminaciones desde el panel.

Los descansos se limitan a medios puntos entre cero y uno, y no pueden compartir jugador y ronda con otra partida o descanso. El alta guarda juntos el descanso y la tabla en una operación auditada. Los títulos conservan la clase libre existente; `campeonato-club` tiene semántica específica en los indicadores públicos. La corrección de una tabla histórica no modifica otras filas ni se habilita si el torneo tiene partidas individuales.

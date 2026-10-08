# Conciliación de la muestra de ajedrez

`npm run verify:data` comprueba que los agregados y las vistas de la demo coincidan con sus datos originales. Un resultado correcto devuelve `ok: true` y `errors: []`; `npm test` comprueba además que el verificador detecte alteraciones deliberadas.

## Qué se contrasta

| Fuente independiente | Resultado contrastado |
|---|---|
| Puestos `rank` de cada tabla oficial | Primeros puestos y podios del perfil y de las clasificaciones de récords. Los empates comparten puesto; no se inventan desempates. |
| Resultados de partidas individuales entre dos jugadores | Victorias, empates, derrotas, colores y partidas de un clásico desde **ambas** perspectivas. |
| Victorias y medio punto por empate de esas partidas | Rendimiento por puntos y porcentaje de victorias del clásico, ambos divididos por partidas al tablero. |

Una tabla sin partidas individuales aporta puestos y puntos oficiales, pero no enfrentamientos, rachas ni denominadores de clásicos. Los descansos tampoco son partidas. El verificador calcula las expectativas directamente de las tablas y resultados originales; no usa el mismo agregado que está contrastando para producir ambos lados de la comparación.

## Alcance

Estas comprobaciones cubren la muestra versionada y el HTML generado por sus renderizadores. No prueban interacción real del navegador, lector de pantalla, legalidad de las jugadas, importación transaccional ni datos de otro club. Un `ok: true` no sustituye la aceptación integral de CC-19.

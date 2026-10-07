# Reglamento de demostración de Casa Morra

**Estado:** reglas propias de la muestra, versión `demo-1`. Definen cómo interpretar `dist/data/demo.js`; **no** describen fórmulas internas de otro club. El núcleo de cálculo es `dist/domain/statistics.js` y las vistas públicas consumen sus resultados.

## Qué contiene la muestra

| Elemento | Cantidad | Uso |
|---|---:|---|
| Temporadas de agosto a julio | 3 | Agrupar eventos y tabla anual. |
| Jugadores ficticios | 6 | Directorio y perfiles. |
| Torneos | 6 | Cuatro de seis participantes, uno de cinco y uno solo con tabla final. |
| Partidas con resultado registrado | 70 | Estadísticas de partidas, colores, clásicos y Elo demo. |
| Byes de un punto | 5 | Solo puntos del torneo; no son partidas. |
| Torneos sin detalle de partidas | 1 | Tabla oficial, anual y participaciones, sin inferir resultados individuales. |

Los cuatro torneos de seis jugadores son todos-contra-todos de una vuelta: 15 partidas por evento, 20 para cada persona y cuatro enfrentamientos por pareja. El torneo de cinco tiene diez partidas y cinco byes, uno por persona. La secuencia de jugadas solo existe en una partida ilustrativa: **la ausencia de jugadas no elimina su resultado**. Una secuencia almacenada como coordenadas UCI no debe anunciarse como archivo PGN completo.

## Fuente de cada cifra

| Cifra | Fuente canónica | Nunca inferir de |
|---|---|---|
| Orden, puesto y puntos oficiales de torneo | `tournament.standings` | Elo, alfabeto o partidas incompletas. |
| Puntos de la anual y participaciones | Filas oficiales de eventos elegibles | Partidas individuales. |
| Partidas, G-E-P, colores y rivales | `games` con resultado | Tabla oficial, bye o disponibilidad de jugadas. |
| Títulos | `titles` explícitos | Primer puesto de un torneo cualquiera. |
| Jugadas reproducibles | Secuencia UCI conocida y admitida por `hasDemoReplay(game)` | Resultado, indicación de planilla o cualquier lista de coordenadas sin soporte del visor. |

En eventos con detalle, el fixture está construido para que los puntos oficiales coincidan con `G + 0,5 × E + puntos de bye`; las pruebas comprueban esa igualdad. **En el evento solo con tabla no hay detalle suficiente para recalcularla**: sus G-E-P figuran como «Sin detalle» y sus puntos/puestos oficiales siguen siendo válidos.

## Reglas estadísticas propuestas

1. **Porcentaje de victorias:** `100 × G / N`, con `N = G + E + P` de partidas registradas. Solo participa en ese récord con `N ≥ 15`; un resultado de **0 % sí es elegible** si cumple el mínimo de partidas.
2. **Rendimiento por puntos:** `100 × (G + 0,5 × E) / N`. Es distinto del porcentaje de victorias. Con `N = 0`, mostrar «Sin partidas», no dividir por cero.
3. **Bye:** suma un punto a la tabla oficial, no añade partida, color, rival, Elo ni clásico. Al ordenar rachas se omite; no las interrumpe.
4. **Rachas:** una tabla corta la racha ganadora pero mantiene la invicta; una derrota corta ambas. Se informa el máximo histórico de cada una.
5. **Clásicos:** una pareja aparece desde cuatro partidas al tablero. G-E-P y colores se calculan desde la perspectiva del primer jugador mostrado; al invertir la pareja se invierten victorias/derrotas y colores.
6. **Tabla anual:** temporadas del 1 de agosto al 31 de julio. Suma puntos oficiales de torneos con `annualEligible: true`, sin bonificaciones. Los empates de puntos comparten puesto de competición (`1, 1, 3`) y se ordenan visualmente por nombre. El movimiento se compara con la clasificación acumulada tras el torneo elegible anterior de esa misma temporada, no con la temporada previa.
7. **Elo de demostración:** empieza en 1400 y usa `K = 20`, expectativa `1 / (1 + 10^((Elo rival − Elo propio) / 400))` y cambio `K × (resultado − expectativa)`. Ambas personas se actualizan desde sus valores previos a la partida. El orden es fecha, torneo, ronda e ID; se conserva precisión interna y solo se redondea al presentar. Los byes y las tablas sin partida no lo alteran. No es Elo FIDE ni Elo de otro club; se indica «provisorio» antes de diez partidas elegibles.

### Comparativos propios del perfil

- **Mejor y peor evento al tablero:** `100 × (G + 0,5 × E) / N`, con al menos una partida real en el torneo. No se usan puntos oficiales, byes ni eventos solo con tabla. Ante igual rendimiento prevalece mayor `N`, luego fecha más antigua e ID ascendente. Se muestra el tamaño de muestra.
- **Rival favorable y adverso:** balance `G − P` desde la perspectiva del perfil, solo frente a rivales con al menos dos partidas al tablero. Los balances neutros no son favorables ni adversos; se muestran G-E-P y `N`. No representan categorías por Elo del rival.

Son **reglas de esta demostración**, no una réplica de los criterios de otro club.

### Diez récords

| # | Métrica | Población |
|---:|---|---|
| 1 | Torneos ganados | Filas oficiales con puesto 1. |
| 2 | Campeonatos del club | Títulos explícitos de tipo `campeonato-club`. |
| 3 | Partidas jugadas | Resultados de `games`. |
| 4 | Partidas ganadas | Victorias en `games`. |
| 5 | Porcentaje de victorias | `G/N`, solo con `N ≥ 15`. |
| 6 | Racha ganadora máxima | `games` en orden cronológico; bye omitido. |
| 7 | Racha invicta máxima | `games` en orden cronológico; bye omitido. |
| 8 | Mayor Elo demo alcanzado | Historial calculado; 1400 inicial incluido. |
| 9 | Torneos jugados | Participaciones en tabla oficial. |
| 10 | Podios | Puestos oficiales 1, 2 o 3. |

En los listados de récords, el valor determina el puesto; los valores iguales comparten puesto y el nombre solo ordena su presentación. Se indican la población, el denominador y los eventos incluidos junto a cada cifra. Ningún récord crea una cuenta de usuario ni una posición «propia» mientras no haya autenticación.

### API del núcleo

Las funciones son módulos ES puros: aceptan `{ players, seasons, tournaments, games, byes, titles }`, no acceden al DOM y devuelven estructuras aptas para Node.js o navegador. `getHomeTotals` devuelve las tres poblaciones de portada; `getPlayerProfile` reconcilia resultados, colores, rachas, torneos oficiales y Elo; `getAnnualStandings` incluye eventos elegibles, instantáneas y movimiento; `getLeaderboards` entrega diez clasificaciones; `getClassics` filtra parejas con cuatro partidas y `getHeadToHead` conserva la perspectiva solicitada, o devuelve `null` ante IDs inexistentes o iguales; `calculateElo` devuelve historial numérico sin redondear. Una tasa con cero partidas es `null` para que la interfaz muestre «Sin partidas». El redondeo y la localización son responsabilidad exclusiva de la vista.

## Reproducción y límites

El visor muestra tablero, texto alternativo y controles de primera/anterior/siguiente/última posición **solo para la secuencia UCI demo revisada**. Reconstruye esa secuencia concreta, incluido un enroque; no importa PGN, no acepta movimientos de visitantes y no valida legalidad ajedrecística general. Resultados sin jugadas siguen contando para estadísticas pero no ofrecen reproducción.

La portada ofrece **una composición original fija de mate en una**, no un problema diario. Su FEN es `8/8/8/8/8/k1K5/4Q3/8 w - - 0 1`; la respuesta prevista es `e2a6` (`Qa6#`). El formulario comprueba esta solución concreta y permite revelarla o reiniciar. No ejecuta un motor de ajedrez ni determina la legalidad de movimientos arbitrarios.

Ejecutar `node --test` para la suite y `npm run verify:data` para obtener la conciliación JSON de jugadores, torneos, partidas y byes. Estas pruebas no sustituyen una revisión visual/manual en navegador.

## Pendiente, no simulado

- No existe panel, importador, edición de resultados, emparejamiento automático ni inscripción real.
- No se conoce un desempate interno de otro club. Casa Morra conserva `rank` y `order` oficiales explícitos; no deduce desempates ocultos.
- Los colores y resultados se verifican por integridad de fixture; la **legalidad ajedrecística general** de jugadas arbitrarias no está implementada ni se presenta como comprobada.
- Un cambio a estas reglas requiere versión nueva, pruebas de ejemplo y conciliación de todas las vistas afectadas.

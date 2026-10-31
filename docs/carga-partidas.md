# Carga de partidas (primera etapa)

Casa Morra conserva las partidas en el almacén demo local. Una partida tiene una identidad única (`id`), un torneo, dos jugadores, fecha, ronda y resultado. Las jugadas pueden ser `null`: esto permite registrar el resultado antes de recibir la planilla.

El módulo `scripts/admin-game.mjs` admite dos operaciones:

- `create`: agrega una partida con resultado y, si se aportan, jugadas. El resultado incrementa puntos y victorias/empates/derrotas de ambos jugadores en la tabla del torneo en la misma transacción.
- `complete`: carga o reemplaza jugadas de una partida existente por su `id`; no vuelve a sumar el resultado.

Las jugadas manuales se escriben como notación algebraica separada por espacios (`e4 e5 Nf3 Nc6`). Un PGN incluye su resultado y debe coincidir con el resultado registrado. `chess.js` valida la legalidad y se guardan coordenadas UCI para la reproducción pública. No se admiten variantes de ajedrez (`Variant`), líneas alternativas de análisis PGN (`(...)`) ni PGN con `SetUp`/`FEN`: el visor parte de la posición inicial estándar y guarda una sola línea de jugadas.

**Regla demo de tabla:** al agregar un resultado, el orden se recalcula por puntos; ante empate se conserva el orden previo y se comparte el puesto. No se reconstruye ni altera una tabla histórica por mera lectura. Los torneos con victorias/empates/derrotas desconocidos (`null`) no aceptan un alta automática: requieren una corrección explícita de la tabla antes de operar. Esta regla es provisional para datos de demostración, no un reglamento oficial de desempates.

El almacén usa hash esperado (CAS), bloqueo exclusivo, escritura atómica, auditoría verificable y reversión de la última operación. La exportación pública sigue separada y nunca expone el historial privado. La interfaz administrativa y la autenticación se incorporan en la siguiente etapa.

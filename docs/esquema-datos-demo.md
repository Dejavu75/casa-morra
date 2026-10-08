# Contrato de snapshot de datos de demostración

Este contrato prepara una futura migración local de **datos ficticios originales** de Casa Morra. No crea una base de datos, API, cuenta, inscripción ni operación de usuarios. Tampoco importa información del sitio usado como referencia.

## Sobre y versión

`scripts/demo-snapshot.mjs` codifica un objeto JSON con cinco campos obligatorios:

| Campo | Valor o significado |
|---|---|
| `format` | `casa-morra.demo-snapshot` |
| `version` | `1`, versión del **esquema**, no del contenido editorial |
| `provenance` | `casa-morra-original-demo`; clasificación declarada de origen, no una firma de autoría |
| `classification` | `public-demo`; prohíbe agregar campos privados sin revisar y versionar el contrato |
| `data` | Las siete colecciones descritas abajo |

El objeto `data` contiene `seasons`, `players`, `tournaments`, `games`, `byes`, `titles` y `editorial`. La tabla oficial permanece en `tournaments[].standings`, con su `order` y `rank` explícitos; no se reconstruye a partir de partidas. `games[].moves` puede ser `null`: un resultado sin jugadas no obtiene PGN artificial. `editorial` contiene `club`, `news` y `classes`. El snapshot no incorpora agregados derivados, Elo calculado ni información de cuentas.

La versión 1 acepta únicamente los campos presentes en el fixture actual. `encodeDemoSnapshot` rechaza claves adicionales, también a nivel de `data` y de cada registro; un campo nuevo exige revisión del esquema y, cuando corresponda, otra versión. Esto evita exportar silenciosamente un correo, token u otro dato ajeno a la demo.

## Codificación, lectura e integridad

La codificación ordena **claves de objetos** de manera estable y conserva el orden de **arreglos**. No incluye fecha de generación ni espacios variables. La misma entrada produce los mismos bytes UTF-8. `snapshotMetadata(json)` informa tamaño y SHA-256 de esos bytes; rechaza JSON válido pero no canónico. El hash sirve para comparar bytes, **no** autentica procedencia ni sustituye una firma.

```js
import * as demo from './dist/data/demo.js';
import { encodeDemoSnapshot, decodeDemoSnapshot, snapshotMetadata } from './scripts/demo-snapshot.mjs';

const json = encodeDemoSnapshot(demo);
const { bytes, sha256 } = snapshotMetadata(json);
const datos = decodeDemoSnapshot(json);
```

`decodeDemoSnapshot` valida formato, versión, forma de los registros, IDs y slugs únicos, referencias entre temporadas/torneos/jugadores/partidas/byes/títulos, resultados y orden explícito de tabla. Devuelve las siete colecciones, sin escribir archivos ni modificar la entrada. Errores como `UNSUPPORTED_VERSION`, `UNKNOWN_PLAYER` o `UNEXPECTED_FIELD` impiden decodificar. Una versión futura deberá tener un migrador explícito: no se interpreta automáticamente con reglas de la versión 1.

Para ver solamente metadatos y cantidades, sin volcar nombres ni generar un archivo: `node scripts/demo-snapshot.mjs`. Para probar el contrato: `node --test test/demo-snapshot.test.mjs`. La comprobación complementaria `npm run verify:data` revisa estadísticas, puntos y vistas; la validación del snapshot **no** la reemplaza ni verifica legalidad de cada jugada.

La muestra comprometida en esta unidad codifica **20.184 bytes UTF-8** con SHA-256 `f8238289ac5ea38ded4911f0667fae32cfa7ef1b87d37affbaf5ff2438488a24`. Ese valor identifica el contenido actual, no es la versión del esquema; cualquier cambio legítimo de datos exige revisar esta referencia y la prueba correspondiente.

## Límite de migración

Esta porción de CC-03 es un formato de intercambio repetible, no un importador transaccional. Quedan pendientes almacenamiento, carga idempotente, correcciones con antes/después, reversión, invalidación de derivados, respaldos y permisos. No se deben añadir cuentas, fotos, inscripciones o datos personales reales a este sobre sin un contrato y una decisión de seguridad específicos.

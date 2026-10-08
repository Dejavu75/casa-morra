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

`decodeDemoSnapshot` valida formato, versión, forma de los registros, IDs y slugs únicos (incluidos los de las novedades), referencias entre temporadas/torneos/jugadores/partidas/byes/títulos, resultados y orden explícito de tabla. Devuelve las siete colecciones, sin escribir archivos ni modificar la entrada. Errores como `UNSUPPORTED_VERSION`, `UNKNOWN_PLAYER` o `UNEXPECTED_FIELD` impiden decodificar. Una versión futura deberá tener un migrador explícito: no se interpreta automáticamente con reglas de la versión 1.

Las fechas de temporada, torneo, partida y novedad deben ser fechas reales en formato `AAAA-MM-DD`; no se comprueba aquí que una partida ocurra dentro de su temporada. El puesto oficial (`rank`) debe ser un entero entre 1 y la cantidad de filas de su tabla; se admiten empates y no se recalculan desempates. Estas comprobaciones semánticas son compartidas por el snapshot y `npm run verify:data`. Un puesto inválido tampoco cuenta como podio en el agregado defensivo.

Para ver solamente metadatos y cantidades, sin volcar nombres ni generar un archivo: `node scripts/demo-snapshot.mjs`. Para probar el contrato: `node --test test/demo-snapshot.test.mjs`. La comprobación complementaria `npm run verify:data` revisa estadísticas, puntos y vistas; la validación del snapshot **no** la reemplaza ni verifica legalidad de cada jugada.

La muestra comprometida en esta unidad codifica **20.184 bytes UTF-8** con SHA-256 `f8238289ac5ea38ded4911f0667fae32cfa7ef1b87d37affbaf5ff2438488a24`. Ese valor identifica el contenido actual, no es la versión del esquema; cualquier cambio legítimo de datos exige revisar esta referencia y la prueba correspondiente.

## Límite de migración

`planDemoSnapshotImport(json, datosVigentes)` agrega una **vista previa en memoria** para revisar un snapshot entrante. Si se omite `datosVigentes`, usa el fixture original incluido en el repositorio. Primero valida tanto la entrada como los datos vigentes mediante el contrato versión 1. Devuelve `counts` y tres listas: `added` (ID nuevo y registro propuesto), `unchanged` (mismo ID y contenido) y `conflicting` (mismo ID con contenido diferente, o slug ocupado, con `current` e `incoming` para revisión humana). El conflicto `DUPLICATE_SLUG` incluye `slugOwnerId` para identificar el registro vigente que ocupa el slug en jugadores, torneos o novedades. El orden de cada lista es determinista por colección e ID; el orden interno de cada tabla oficial se conserva exactamente y nunca se recalculan desempates.

```js
import * as demo from './dist/data/demo.js';
import { encodeDemoSnapshot } from './scripts/demo-snapshot.mjs';
import { planDemoSnapshotImport } from './scripts/import-plan.mjs';

const plan = planDemoSnapshotImport(encodeDemoSnapshot(demo));
console.log(plan.counts); // { added: 0, unchanged: 97, conflicting: 0 }
```

Las colecciones con registros se comparan por su `id`. `editorial.club` es un documento único sin ID en el esquema; el plan usa la clave lógica fija `club`. Una fila vigente omitida en el snapshot entrante **no** se borra ni se representa como conflicto: este plan solo anticipa posibles altas y cambios. La omisión tampoco libera su slug para una nueva alta o edición. Un conflicto no autoriza ni aplica una corrección. La función no escribe archivos, no modifica los objetos recibidos, no cambia las vistas y no ofrece CLI de importación.

Esta porción de CC-03 sigue sin ser un importador transaccional. Quedan pendientes almacenamiento, aplicación idempotente, resolución y auditoría de correcciones con antes/después, reversión, invalidación de derivados, respaldos y permisos. No se deben añadir cuentas, fotos, inscripciones o datos personales reales a este sobre sin un contrato y una decisión de seguridad específicos.

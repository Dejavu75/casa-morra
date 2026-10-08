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

Las colecciones con registros se comparan por su `id`. `editorial.club` es un documento único sin ID en el esquema; el plan usa la clave lógica fija `club`. Una fila vigente omitida en el snapshot entrante **no** se borra ni se representa como conflicto: este plan solo anticipa posibles altas y cambios. La omisión tampoco libera su slug para una nueva alta o edición. Un conflicto no autoriza ni aplica una corrección. La función no escribe archivos, no modifica los objetos recibidos ni cambia las vistas.

`prepareDemoSnapshotImport(json, datosVigentes)` permite preparar **solo en memoria** una unión validada cuando el plan no tiene conflictos. Devuelve `beforeSnapshot` y `afterSnapshot` canónicos y un `journal` con SHA-256/tamaño de ambos, identidades agregadas y nombres de vistas potencialmente afectadas. Las filas omitidas se conservan; las altas se agregan en orden determinista y las tablas oficiales existentes permanecen intactas. Repetir la preparación contra el resultado no duplica filas. Un cambio de ID existente, un slug ocupado o cualquier otro conflicto **rechaza** toda la preparación: no se resuelve automáticamente. Además, la unión se contrasta con la verificación independiente de la tabla oficial; si una partida o bye nuevo contradice sus puntos o G/E/P, tampoco se prepara ni persiste.

```js
import { prepareDemoSnapshotImport, restorePreparedDemoSnapshotImport } from './scripts/import-apply.mjs';

const preparado = prepareDemoSnapshotImport(json, datosVigentes);
const datosSiguientes = decodeDemoSnapshot(preparado.afterSnapshot);
const anterior = restorePreparedDemoSnapshotImport(preparado, datosSiguientes);
```

La reversión devuelve exactamente el snapshot canónico anterior **solo si** el estado vigente coincide con `afterSnapshot` y los hashes del diario coinciden. El diario identifica vistas de `renderRoute` que habría que recalcular; no invalida cachés ni actualiza pantallas por sí mismo. Es una guía conservadora: por ejemplo, una noticia afecta portada y noticias, mientras un bye afecta los resultados del torneo sin recalcular la clasificación oficial desde las partidas.

La preparación en memoria no escribe fixtures ni publica datos. El siguiente almacén local es una operación **explícita y separada**; tampoco habilita correcciones de filas existentes ni una API.

## Almacén local de demostración

`scripts/demo-store.mjs` conserva snapshots `v1` ficticios en un archivo bajo `.demo-state/`, directorio ignorado por Git. El operador debe dar siempre `--store`; el programa no busca ni modifica un almacén automáticamente. `init` crea únicamente la raíz `.demo-state/` si falta; los subdirectorios personalizados deben existir previamente. Ejemplo desde la raíz del repositorio:

```sh
node scripts/demo-store.mjs init --store .demo-state/casa-morra.json
node scripts/demo-store.mjs status --store .demo-state/casa-morra.json
node scripts/demo-store.mjs apply --store .demo-state/casa-morra.json --input .demo-state/entrada.json
node scripts/demo-store.mjs correct --store .demo-state/casa-morra.json --input .demo-state/correccion.json --expected-sha SHA256_VIGENTE --allowlist .demo-state/identidades.json
node scripts/demo-store.mjs backup --store .demo-state/casa-morra.json --backup .demo-state/respaldo-01.json
node scripts/demo-store.mjs restore --store .demo-state/casa-morra.json --backup .demo-state/respaldo-01.json
node scripts/demo-store.mjs rollback --store .demo-state/casa-morra.json
```

`init` usa exclusivamente el fixture comprometido. `apply` lee un snapshot canónico provisto explícitamente y acepta **solo altas sin conflictos**; una repetición idéntica no escribe ni agrega un evento. `rollback` revierte únicamente la última aplicación, corrección o restauración cuando el estado vigente coincide; no borra la auditoría. `status` informa hash, tamaño y cantidad de eventos sin imprimir registros. Las operaciones no cambian el fixture, la imagen Docker ni el sitio web servido: las vistas listadas en la auditoría son una indicación para una invalidación **futura**, no una invalidación real.

### Correcciones auditadas de registros ficticios

`correct` cambia registros existentes únicamente si el operador aporta: el snapshot `v1` canónico de demostración, el SHA-256 que devolvió `status` para el estado vigente y un archivo JSON con la lista **exacta** de identidades a modificar, por ejemplo `[{"collection":"games","id":"patio-2025-r1-p1"},{"collection":"tournaments","id":"patio-2025"}]`. La lista no admite duplicados ni identidades sin cambio; `editorial.club` usa el ID lógico `club`. Un hash obsoleto, un ID nuevo o alterado, una diferencia fuera de la lista, un slug ocupado, una referencia inválida o cualquier error de `verify:data` rechaza toda la operación antes de sustituir el archivo. Los registros omitidos en la propuesta y el orden oficial previo se conservan. No se sintetizan desempates, puestos, Elo ni PGN.

Al cambiar un resultado, el operador debe incluir **en la misma corrección** la tabla oficial completa y coherente del torneo. Corregir solo la partida falla por discrepancia entre puntos o G/E/P y tabla. El evento `correct` guarda antes/después, hashes, propuesta, identidades corregidas y vistas potencialmente afectadas; al reabrir se reproduce y verifica contra el estado anterior. Reintentar exactamente la última corrección con el hash original no agrega otro evento; `rollback` revierte la última corrección con un nuevo evento, sin borrar el historial. La lista de vistas es **declarativa**: no invalida la interfaz ni integra el almacén con Docker. `CC-03` sigue abierta para esa integración y las funciones de operación más amplias.

### Respaldo y restauración explícitos

`backup` valida el almacén bajo su bloqueo cooperativo y crea un archivo de respaldo nuevo **sin sobrescribir**. El respaldo contiene el sobre íntegro, su tamaño y SHA-256, y el ID del último evento. Se vuelve a leer y validar antes de informar éxito. Tanto el almacén como el respaldo deben estar bajo `.demo-state/`; no se crean subdirectorios y se rechazan enlaces simbólicos detectados en la ruta. Elegí un nombre nuevo para cada copia y guardala fuera de la imagen Docker. No incluyas datos reales ni secretos.

`restore` valida formato, versión, hash, snapshot y cadena de auditoría del respaldo. Solo acepta una copia cuyo historial completo sea un **prefijo idéntico** del almacén vigente: una copia de otro linaje o de una rama divergente se rechaza. Si el snapshot ya coincide, no escribe. Si difiere, agrega un evento `restore` al historial vigente, conserva los eventos anteriores y cambia al snapshot del respaldo. `rollback` puede revertir esa última restauración mediante otro evento. La restauración no reemplaza el archivo con un historial antiguo ni borra operaciones posteriores.

El SHA-256 detecta daños accidentales, no demuestra quién creó la copia: alguien con permiso de escritura puede alterar el contenido y recalcularlo. El bloqueo es cooperativo, y la comprobación de rutas no protege contra un proceso hostil que cambie el sistema de archivos entre controles. El respaldo en el mismo disco **no es recuperación ante desastre**; copiálo por un procedimiento externo autorizado si necesitás resiliencia física. En Windows, el `fsync` del directorio no está garantizado ante un corte eléctrico. Antes de reintentar una operación interrumpida, verificá el estado con `status` y nunca borres un `.lock` sin investigar su origen.

El archivo contiene un sobre versionado con snapshot vigente y eventos de origen `local-demo`. Cada evento guarda un ID, operación, bytes y SHA-256 antes/después, y el snapshot correspondiente; las aplicaciones guardan también las altas y vistas afectadas. Al reabrir, se valida la cadena y la relación entre snapshots. El hash detecta alteraciones accidentales, **no** autentica autoría: quien puede escribir el archivo puede reescribir toda la cadena. Los datos son exclusivamente ficticios; no coloques información personal ni credenciales en este directorio.

Cada escritura usa un bloqueo exclusivo (`.lock`) que **no se elimina automáticamente** si queda abandonado; ante un lock previo la operación falla cerrada. Se escribe un temporal en el mismo directorio, se sincroniza el archivo y se sustituye por renombrado atómico, con comparación del contenido vigente antes de sustituir. Se rechazan rutas fuera de `.demo-state/` y enlaces simbólicos detectados en sus componentes. Es una protección operativa local, no una defensa contra otro proceso hostil que modifique rutas entre comprobación y renombrado; el bloqueo es cooperativo. En Windows, la sincronización del directorio y la persistencia tras un corte eléctrico no se pueden garantizar con esta implementación. Un fallo posterior al renombrado puede dejar la escritura efectuada aunque el proceso no haya terminado normalmente; reabrí con `status` antes de reintentar.

El almacén no provee acceso multiusuario, permisos de cuentas, invalidación real de derivados ni persistencia dentro de Docker. Estos criterios de `CC-03` siguen abiertos, junto con la verificación estadística integral de `CC-05/19`. Para probar esta unidad: `node --test test/demo-store.test.mjs`, `npm test` y `npm run verify:data`.

### Exportación pública manual

El almacén `.demo-state/` contiene auditoría, propuestas y respaldos; **nunca** debe montarse ni servirse por HTTP. La exportación crea un único JSON ficticio separado bajo `.demo-public/`, también ignorado por Git. Son dos pasos explícitos desde la raíz del repositorio:

```sh
node scripts/demo-public.mjs publish --store .demo-state/casa-morra.json --output .demo-public/snapshot.json
node scripts/demo-public.mjs status --store .demo-state/casa-morra.json --output .demo-public/snapshot.json
```

`publish` exige un almacén válido y exporta únicamente `format`, `version`, `source` (SHA-256 y bytes del snapshot canónico) y `snapshot` público `v1`. No exporta el sobre, la auditoría, los respaldos ni los locks. Repetir una publicación idéntica deja los bytes intactos. `status` informa `exists` y `fresh`; un cambio de contenido tras `apply`, `correct`, `restore` o `rollback` vuelve obsoleta la exportación hasta repetir `publish`. La frescura compara contenido, no la secuencia de eventos; una restauración a los mismos bytes publicados puede seguir fresca.

El destino debe estar dentro de `.demo-public/`; se rechazan enlaces simbólicos detectados y exportaciones previas corruptas. La sustitución de **ese archivo** usa temporal, sincronización, comparación contra la versión previa y renombrado. No es una transacción multiarchivo con el almacén ni protege contra procesos hostiles o cortes eléctricos en Windows. Después de un error, repetí `status` antes de decidir si reintentar. Esta exportación **no** conecta todavía Docker ni la interfaz web, ni realiza invalidación viva; `CC-03` permanece abierta. Nunca publiques datos personales o reales mediante este canal.

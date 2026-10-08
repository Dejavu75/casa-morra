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

`prepareDemoSnapshotImport(json, datosVigentes)` permite preparar **solo en memoria** una unión validada cuando el plan no tiene conflictos. Devuelve `beforeSnapshot` y `afterSnapshot` canónicos y un `journal` con SHA-256/tamaño de ambos, identidades agregadas y nombres de vistas potencialmente afectadas. Las filas omitidas se conservan; las altas se agregan en orden determinista y las tablas oficiales existentes permanecen intactas. Repetir la preparación contra el resultado no duplica filas. Un cambio de ID existente, un slug ocupado o cualquier otro conflicto **rechaza** toda la preparación: no se resuelve automáticamente.

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
node scripts/demo-store.mjs rollback --store .demo-state/casa-morra.json
```

`init` usa exclusivamente el fixture comprometido. `apply` lee un snapshot canónico provisto explícitamente y acepta **solo altas sin conflictos**; una repetición idéntica no escribe ni agrega un evento. `rollback` revierte únicamente la última aplicación cuando el estado vigente coincide; no borra la auditoría. `status` informa hash, tamaño y cantidad de eventos sin imprimir registros. Las operaciones no cambian el fixture, la imagen Docker ni el sitio web servido: las vistas listadas en la auditoría son una indicación para una invalidación **futura**, no una invalidación real.

El archivo contiene un sobre versionado con snapshot vigente y eventos de origen `local-demo`. Cada evento guarda un ID, operación, bytes y SHA-256 antes/después, y el snapshot correspondiente; las aplicaciones guardan también las altas y vistas afectadas. Al reabrir, se valida la cadena y la relación entre snapshots. El hash detecta alteraciones accidentales, **no** autentica autoría: quien puede escribir el archivo puede reescribir toda la cadena. Los datos son exclusivamente ficticios; no coloques información personal ni credenciales en este directorio.

Cada escritura usa un bloqueo exclusivo (`.lock`) que **no se elimina automáticamente** si queda abandonado; ante un lock previo la operación falla cerrada. Se escribe un temporal en el mismo directorio, se sincroniza el archivo y se sustituye por renombrado atómico, con comparación del contenido vigente antes de sustituir. Se rechazan rutas fuera de `.demo-state/` y enlaces simbólicos detectados en sus componentes. Es una protección operativa local, no una defensa contra otro proceso hostil que modifique rutas entre comprobación y renombrado; el bloqueo es cooperativo. En Windows, la sincronización del directorio y la persistencia tras un corte eléctrico no se pueden garantizar con esta implementación. Un fallo posterior al renombrado puede dejar la escritura efectuada aunque el proceso no haya terminado normalmente; reabrí con `status` antes de reintentar.

El almacén no provee copia de seguridad/restauración verificada, acceso multiusuario, permisos de cuentas, correcciones auditadas de filas existentes, invalidación de derivados ni persistencia dentro de Docker. Esos criterios de `CC-03` siguen abiertos, junto con la verificación estadística integral de `CC-05/19`. Para probar esta unidad: `node --test test/demo-store.test.mjs`, `npm test` y `npm run verify:data`.

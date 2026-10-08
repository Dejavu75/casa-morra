import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/verify.yml', import.meta.url), 'utf8');

test('la CI verifica push y PR con permisos mínimos y acciones fijadas', () => {
  assert.match(workflow, /^on:\s*\n\s+push:\s*\n\s+pull_request:/m);
  assert.match(workflow, /^permissions:\s*\n\s+contents:\s*read/m);
  const actions = [...workflow.matchAll(/uses:\s*(actions\/[\w-]+@[\da-f]{40})/g)].map((match) => match[1]);
  assert.equal([...workflow.matchAll(/^\s+uses:/gm)].length, actions.length,
    'todas las acciones deben usar referencias SHA completas');
  assert.deepEqual(actions, [
    'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
    'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020',
  ]);
  assert.match(workflow, /node-version:\s*['"]22['"]/);
  assert.match(workflow, /persist-credentials:\s*false/);
  assert.match(workflow, /package-manager-cache:\s*false/);
  assert.doesNotMatch(workflow, /pull_request_target|id-token:\s*write|contents:\s*write/);
});

test('la CI prueba datos y construye Docker sin publicación ni secretos', () => {
  assert.match(workflow, /run:\s*npm test/);
  assert.match(workflow, /run:\s*npm run verify:data/);
  assert.match(workflow, /run:\s*docker build\s+--tag casa-morra:ci\s+\./);
  assert.doesNotMatch(workflow, /docker\s+(?:push|login)|secrets\.|GITHUB_TOKEN|ghcr\.io|docker\.io\/dhzacur/);
});

test('la CI verifica las respuestas gzip en un contenedor efímero local', () => {
  assert.match(workflow, /docker run[\s\S]*--publish 127\.0\.0\.1:18089:8080[\s\S]*casa-morra:ci/);
  assert.match(workflow, /CASA_MORRA_TEST_URL=http:\/\/127\.0\.0\.1:18089 node --test test\/gzip-runtime\.test\.mjs/);
  assert.match(workflow, /trap 'docker rm -f casa-morra-gzip-ci[^']*' EXIT/);
});

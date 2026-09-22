import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSkill } from '../dist/index.js';
import { DiagnosticError, formatDebugChain, formatDiagnostic, normalizeDiagnostic } from '../dist/diagnostics.js';
import { MultiOutputPublishError } from '../dist/index.js';
import { formatMultiOutputDiagnostic } from '../dist/diagnostics.js';

const bytes = (value) => new TextEncoder().encode(value);
const failure = (text) => {
  try { generateSkill({ serviceId: 'users', skillName: 'users-api', documents: new Map([['account', bytes(text)]]) }); }
  catch (error) { return error; }
  assert.fail('generation should fail');
};

test('reports stable one-based JSON locations without echoing input', () => {
  const lf = formatDiagnostic(normalizeDiagnostic(failure('{\n  "openapi": "3.1.0",\n  "secret": "do-not-print",\n  "paths" false\n}')));
  assert.match(lf, /^ERROR users\/account \[PARSE\/INVALID_JSON\]:/);
  assert.match(lf, /line 4, column 11/);
  assert.doesNotMatch(lf, /do-not-print|SyntaxError| at /);

  const crlf = formatDiagnostic(normalizeDiagnostic(failure('{\r\n  "openapi":"3.1.0",\r\n  "中文": true,\r\n  "paths" false\r\n}')));
  assert.match(crlf, /line 4, column 11/);
});

test('reports the second duplicate key and its location', () => {
  const rendered = formatDiagnostic(normalizeDiagnostic(failure('{\n "openapi":"3.1.0",\n "paths":{},\n "paths":{}\n}')));
  assert.match(rendered, /\[PARSE\/INVALID_JSON\]/);
  assert.match(rendered, /duplicate key paths/);
  assert.match(rendered, /line 4, column 2/);
});

test('normalizes errors without reliable locations and unknown values', () => {
  const noLocation = new DiagnosticError({ phase: 'PARSE', code: 'INVALID_JSON', safeMessage: 'expected a single JSON object' });
  assert.equal(formatDiagnostic(noLocation), 'ERROR [PARSE/INVALID_JSON]: expected a single JSON object');
  assert.equal(formatDiagnostic(normalizeDiagnostic(42)), 'ERROR [INTERNAL/UNEXPECTED_ERROR]: Unexpected non-error failure');
});

test('debug chains are complete and bounded for cycles and depth', () => {
  const root = new DiagnosticError({ phase: 'PARSE', code: 'INVALID_JSON', safeMessage: 'bad document' });
  const child = new Error('secret low-level reason');
  root.cause = child;
  child.cause = root;
  const output = formatDebugChain(root);
  assert.match(output, /DiagnosticError: INVALID_JSON: bad document/);
  assert.match(output, /Caused by: Error: secret low-level reason/);
  assert.match(output, /circular cause/);
  assert.ok(output.split('\n').length < 80);

  let deep = new Error('cause 20');
  for (let index = 19; index >= 0; index--) deep = new Error(`cause ${index}`, { cause: deep });
  assert.match(formatDebugChain(deep, 4), /cause chain truncated after 4 levels/);
});

test('formats multi-output publication results without raw failure details', () => {
  const error = new MultiOutputPublishError([
    { skillDirectory: '/first/api-docs', status: 'success' },
    { skillDirectory: '/blocked/api-docs', status: 'failed', error: new Error('TOP-SECRET raw failure') },
    { skillDirectory: '/last/api-docs', status: 'success' }
  ]);
  const rendered = formatMultiOutputDiagnostic(error);
  assert.match(rendered, /^ERROR \[PUBLISH\/MULTI_OUTPUT_FAILED\]: 1 of 3 output targets failed/m);
  assert.match(rendered, /^OK \/first\/api-docs$/m);
  assert.match(rendered, /^FAILED \/blocked\/api-docs \[PUBLISH\/TARGET_FAILED\]: Unable to publish generated Skill$/m);
  assert.match(rendered, /^OK \/last\/api-docs$/m);
  assert.doesNotMatch(rendered, /TOP-SECRET/);
});

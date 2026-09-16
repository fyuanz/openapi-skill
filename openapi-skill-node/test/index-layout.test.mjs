import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateProjectSkill, generateSkill } from '../dist/index.js';
import { semanticFile } from '../dist/references.js';

const encoder = new TextEncoder();
const input = encoder.encode(JSON.stringify({
  openapi: '3.1.0',
  paths: {
    '/users/{id}': { get: { operationId: 'duplicate', summary: 'Get user', tags: ['users'], responses: {
      200: { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserView' } } } }
    } } },
    '/users': { post: { operationId: 'duplicate', responses: { 201: { description: 'created' } } } }
  },
  components: { schemas: { UserView: { type: 'object' }, 'user-view': { type: 'string' } } }
}));

const jsonLines = (content) => content.trim().split('\n').map((line) => JSON.parse(line));

test('emits openapi-skill core/1 semantic indexes and short readable file names', () => {
  const files = generateSkill({ serviceId: 'svc', skillName: 'svc-api', documents: new Map([['public', input]]) });
  assert.equal(JSON.parse(files.get('references/source.json')).generatorVersion, 'openapi-skill-core/1');
  assert.ok(files.has('references/operations.jsonl'));
  assert.ok(files.has('references/schemas.jsonl'));
  assert.ok(files.has('references/conventions.md'));
  assert.ok([...files.keys()].some((path) => /\/operations\/get-users-by-id--[0-9a-f]{6}\.md$/.test(path)));
  assert.ok([...files.keys()].some((path) => /\/schemas\/user-view--[0-9a-f]{6}\.md$/.test(path)));
  assert.ok([...files.keys()].every((path) => !/(?:^|-)[0-9a-f]{64}\.md$/.test(path.split('/').at(-1))));

  const operations = jsonLines(files.get('references/operations.jsonl'));
  assert.deepEqual(operations.map(({ id }) => id), [
    'operation:svc:public:get:/users/{id}',
    'operation:svc:public:post:/users'
  ]);
  assert.ok(operations.every(({ sourceOperationId }) => sourceOperationId === 'duplicate'));
  assert.ok(operations.every(({ file }) => files.has(`references/${file}`)));
  assert.deepEqual(jsonLines(files.get('references/schemas.jsonl')).map(({ id }) => id), [
    'schema:svc:public:#/components/schemas/UserView',
    'schema:svc:public:#/components/schemas/user-view'
  ]);
});

test('keeps the catalog compact and centralizes conventions', () => {
  const files = generateSkill({ serviceId: 'svc', skillName: 'svc-api', documents: new Map([['public', input]]) });
  const catalog = files.get('references/catalog.md');
  assert.doesNotMatch(catalog, /GET \/users/);
  assert.doesNotMatch(catalog, /UserView/);
  assert.match(catalog, /2 operation\(s\)/);
  assert.match(catalog, /2 schema\(s\)/);
  const operation = [...files.entries()].find(([path]) => path.includes('/operations/'))[1];
  assert.doesNotMatch(operation, /## How to read the defaults above/);
  assert.match(operation, /conventions\.md/);
  assert.match(files.get('references/conventions.md'), /not a claim/);
});

test('project mode retains searchable service indexes and openapi-skill core/1 provenance', () => {
  const files = generateProjectSkill({ services: [
    { serviceId: 'orders', documents: new Map([['public', input]]) },
    { serviceId: 'users', documents: new Map([['public', input]]) }
  ] });
  assert.equal(JSON.parse(files.get('references/source.json')).generatorVersion, 'openapi-skill-core/1');
  for (const service of ['orders', 'users']) {
    assert.ok(files.has(`references/services/${service}/references/operations.jsonl`));
    assert.ok(files.has(`references/services/${service}/references/schemas.jsonl`));
  }
  assert.match(files.get('SKILL.md'), /operations\.jsonl/);
  assert.match(files.get('SKILL.md'), /only the referenced schema closure/i);
});

test('extends the six-character suffix only for a detected file collision', () => {
  const first = semanticFile('UserView', 'first');
  const extended = semanticFile('UserView', 'first', new Set([first.toLowerCase()]));
  assert.match(first, /^user-view--[0-9a-f]{6}\.md$/);
  assert.match(extended, /^user-view--[0-9a-f]{10}\.md$/);
});

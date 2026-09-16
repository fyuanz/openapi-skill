import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateProjectSkill, generateSkill } from '../dist/index.js';
import { semanticFiles } from '../dist/references.js';

const encoder = new TextEncoder();
const input = encoder.encode(JSON.stringify({
  openapi: '3.1.0',
  paths: {
    '/users/{id}': { get: { operationId: 'duplicate', summary: 'Get user', tags: ['users'], responses: {
      200: { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserView' } } } }
    } } },
    '/users': { post: { operationId: 'duplicate', responses: { 201: { description: 'created' } } } }
  },
  components: { schemas: { UserView: { type: 'object' }, 'user-view': { type: 'string' }, Payload: { type: 'object' } } }
}));

const jsonLines = (content) => content.trim().split('\n').map((line) => JSON.parse(line));

test('emits core/2 document navigation, clean paths and retained machine indexes', () => {
  const files = generateSkill({ serviceId: 'svc', skillName: 'svc-api', documents: new Map([['public', input]]) });
  assert.equal(JSON.parse(files.get('references/source.json')).generatorVersion, 'openapi-skill-core/2');
  assert.ok(files.has('references/operations.jsonl'));
  assert.ok(files.has('references/schemas.jsonl'));
  assert.ok(files.has('references/conventions.md'));
  assert.ok(files.has('references/documents/public/operations/get-users-by-id.md'));
  assert.ok(files.has('references/documents/public/operations/post-users.md'));
  assert.ok(files.has('references/documents/public/schemas/payload.md'));
  assert.equal([...files.keys()].filter((path) => /\/schemas\/user-view--[0-9a-f]{6}\.md$/.test(path)).length, 2);
  const context = files.get('references/documents/public/context.md');
  assert.match(context, /## Interfaces/);
  assert.match(context, /\[Get user\]\(operations\/get-users-by-id\.md\)/);
  assert.match(context, /`GET \/users\/&#123;id&#125;`/);
  assert.match(context, /Tags: users/);
  assert.doesNotMatch(files.get('SKILL.md'), /operations\.jsonl|schemas\.jsonl/);
  assert.match(files.get('SKILL.md'), /context\.md/);

  const operations = jsonLines(files.get('references/operations.jsonl'));
  assert.deepEqual(operations.map(({ id }) => id), [
    'operation:svc:public:get:/users/{id}',
    'operation:svc:public:post:/users'
  ]);
  assert.ok(operations.every(({ sourceOperationId }) => sourceOperationId === 'duplicate'));
  assert.ok(operations.every(({ file }) => files.has(`references/${file}`)));
  assert.deepEqual(jsonLines(files.get('references/schemas.jsonl')).map(({ id }) => id), [
    'schema:svc:public:#/components/schemas/UserView',
    'schema:svc:public:#/components/schemas/user-view',
    'schema:svc:public:#/components/schemas/Payload'
  ].sort());
});

test('keeps the catalog compact and centralizes conventions', () => {
  const files = generateSkill({ serviceId: 'svc', skillName: 'svc-api', documents: new Map([['public', input]]) });
  const catalog = files.get('references/catalog.md');
  assert.doesNotMatch(catalog, /GET \/users/);
  assert.doesNotMatch(catalog, /UserView/);
  assert.match(catalog, /2 operation\(s\)/);
  assert.match(catalog, /3 schema\(s\)/);
  const operation = [...files.entries()].find(([path]) => path.includes('/operations/'))[1];
  assert.doesNotMatch(operation, /## How to read the defaults above/);
  assert.match(operation, /conventions\.md/);
  assert.match(files.get('references/conventions.md'), /not a claim/);
});

test('project mode navigates through document contexts and retains machine indexes', () => {
  const files = generateProjectSkill({ services: [
    { serviceId: 'orders', documents: new Map([['public', input]]) },
    { serviceId: 'users', documents: new Map([['public', input]]) }
  ] });
  assert.equal(JSON.parse(files.get('references/source.json')).generatorVersion, 'openapi-skill-core/2');
  for (const service of ['orders', 'users']) {
    assert.ok(files.has(`references/services/${service}/references/operations.jsonl`));
    assert.ok(files.has(`references/services/${service}/references/schemas.jsonl`));
  }
  assert.doesNotMatch(files.get('SKILL.md'), /operations\.jsonl|schemas\.jsonl/);
  assert.match(files.get('SKILL.md'), /context\.md/);
  assert.match(files.get('SKILL.md'), /complete referenced contracts/i);
});

test('uses clean names and suffixes every member of a real collision group', () => {
  assert.equal(semanticFiles(new Map([['first', 'UserView']])).get('first'), 'user-view.md');
  const colliding = semanticFiles(new Map([['first', 'UserView'], ['second', 'user-view']]));
  assert.match(colliding.get('first'), /^user-view--[0-9a-f]{6}\.md$/);
  assert.match(colliding.get('second'), /^user-view--[0-9a-f]{6}\.md$/);
  assert.notEqual(colliding.get('first'), colliding.get('second'));
  assert.match(semanticFiles(new Map([['unicode', '航线任务']])).get('unicode'), /^item--[0-9a-f]{6}\.md$/);
  assert.match(semanticFiles(new Map([['reserved', 'CON']])).get('reserved'), /^con--[0-9a-f]{6}\.md$/);
});

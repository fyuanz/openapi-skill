import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { generateSkill } from '../dist/index.js';

const fixture = async (id) => new Uint8Array(await readFile(new URL(`../../testbeds/springdoc-multi-package/fixtures/${id}.json`, import.meta.url)));

test('generates one deterministic navigable skill from multiple documents', async () => {
  const documents = new Map([['business', await fixture('business')], ['account', await fixture('account')]]);
  const first = generateSkill({ serviceId: 'springdoc-multi-package', skillName: 'springdoc-multi-package-api', documents });
  const second = generateSkill({ serviceId: 'springdoc-multi-package', skillName: 'springdoc-multi-package-api', documents });
  assert.deepEqual(first, second);
  assert.equal([...first.keys()].filter((path) => path.includes('/operations/')).length, 4);
  assert.equal([...first.keys()].filter((path) => path.includes('/schemas/')).length, 7);
  const source = JSON.parse(first.get('references/source.json'));
  assert.equal(source.generatorVersion, 'smartdoc-agent-core/1');
  assert.deepEqual(source.documents.map(({ documentId }) => documentId), ['account', 'business']);
  assert.match(first.get('SKILL.md'), /references\/catalog\.md/);
});

test('preserves overrides and rejects unsupported inputs', () => {
  const valid = new TextEncoder().encode(JSON.stringify({
    openapi: '3.1.0', servers: [{ url: 'https://root.invalid' }], security: [{ auth: [] }],
    paths: { '/x': { parameters: [{ name: 'x', in: 'query', required: true }], get: {
      servers: [], security: [], parameters: [{ name: 'x', in: 'query', required: false }], responses: {}
    } } }, components: { schemas: { A: { type: ['string', 'null'] } } }
  }));
  const files = generateSkill({ serviceId: 'svc', skillName: 'svc-api', documents: new Map([['public', valid]]) });
  const operation = [...files.entries()].find(([path]) => path.includes('/operations/'))[1];
  const contract = JSON.parse(operation.match(/```json\n([\s\S]*?)\n```/)[1]);
  assert.deepEqual(contract.servers, []);
  assert.deepEqual(contract.security, []);
  assert.equal(contract.parameters[0].required, false);
  assert.throws(() => generateSkill({ serviceId: 'Bad', skillName: 'api', documents: new Map([['public', valid]]) }), /IDENTITY/);
  assert.throws(() => generateSkill({ serviceId: 'svc', skillName: 'api', documents: new Map([['public', new TextEncoder().encode('{"openapi":"3.0.0","paths":{}}')]]) }), /UNSUPPORTED_VERSION/);
  assert.throws(() => generateSkill({ serviceId: 'svc', skillName: 'api', documents: new Map([['public', new TextEncoder().encode('{"openapi":"3.1.0","paths":{},"paths":{}}')]]) }), /INVALID_JSON/);
});

test('keeps local references navigable and rejects external references', () => {
  const local = new TextEncoder().encode('{"openapi":"3.1.0","paths":{},"components":{"schemas":{"A":{"$ref":"#/components/schemas/B"},"B":{"$ref":"#/components/schemas/A"}}}}');
  const files = generateSkill({ serviceId: 'svc', skillName: 'api', documents: new Map([['public', local]]) });
  for (const [path, content] of files) {
    if (!path.endsWith('.md')) continue;
    for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
      const base = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      const resolved = new URL(match[1], `file:///${base}`).pathname.slice(1);
      assert.ok(files.has(resolved), `${path} -> ${resolved}`);
    }
  }
  const external = new TextEncoder().encode(new TextDecoder().decode(local).replace('#/components/schemas/B', 'https://example.com/B'));
  assert.throws(() => generateSkill({ serviceId: 'svc', skillName: 'api', documents: new Map([['public', external]]) }), /only document-local/);
});

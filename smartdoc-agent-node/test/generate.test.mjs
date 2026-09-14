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

test('explains OpenAPI default semantics and carries Chinese triggers', async () => {
  const documents = new Map([['business', await fixture('business')], ['account', await fixture('account')]]);
  const files = generateSkill({ serviceId: 'springdoc-multi-package', skillName: 'springdoc-multi-package-api', documents });
  const entry = files.get('SKILL.md');

  // Frontmatter must carry bilingual task-verb triggers, not just keywords.
  const close = entry.indexOf('\n---\n');
  assert.ok(close > 0, 'frontmatter must be closed');
  const description = entry.slice(entry.indexOf('description: ') + 'description: '.length, close);
  for (const verb of ['查找', '解释', '实现', '调试', 'finding', 'explaining', 'implementing', 'debugging']) {
    assert.ok(description.includes(verb), `description must include the task verb ${verb}`);
  }
  for (const keyword of ['接口', '前端', '文档', '调用', '参数校验', '接口联调', '字段缺失', '鉴权', '报错排查',
    '状态码', '前端请求代码', 'catalog', 'HTTP', 'REST', 'OpenAPI']) {
    assert.ok(description.includes(keyword), `description must include ${keyword}: ${description}`);
  }
  assert.ok(description.includes('springdoc-multi-package'), 'description must still name the service');
  assert.ok(description.includes('account') && description.includes('business'), 'description must name the groups');
  assert.ok(!description.includes(': '), 'description must stay a single YAML plain scalar');
  assert.ok(!description.includes('\n'), 'description must be a single line');
  assert.ok(description.length <= 1024, 'description must stay within 1024 characters');
  assert.ok(!entry.includes('仅用于文档契约验证'), 'untrusted source text must not enter the template');

  // Every operation file must state what its defaults mean.
  const operations = [...files.entries()].filter(([path]) => path.includes('/operations/'));
  assert.equal(operations.length, 4);
  for (const [path, content] of operations) {
    assert.match(content, /## How to read the defaults above/, `${path} must carry the semantics section`);
    assert.ok(content.includes('not a claim'), `${path} must not leave an unstated fact unexplained`);
  }

  // An explicit empty security override must be called out as a declared override.
  const override = new TextEncoder().encode(JSON.stringify({
    openapi: '3.1.0', security: [{ auth: [] }],
    paths: { '/open': { get: { security: [], responses: {} } } },
    components: { securitySchemes: { auth: { type: 'http', scheme: 'bearer' } } }
  }));
  const explicit = generateSkill({ serviceId: 'svc', skillName: 'svc-api', documents: new Map([['public', override]]) });
  const explicitOperation = [...explicit.entries()].find(([path]) => path.includes('/operations/'))[1];
  assert.match(explicitOperation, /declares an explicit empty `security`/);
});

test('description stays a bounded single-line value for many groups', () => {
  const documents = new Map();
  for (let i = 0; i < 32; i++) documents.set('g' + 'x'.repeat(52) + i, new TextEncoder().encode('{"openapi":"3.1.0","paths":{}}'));
  const files = generateSkill({ serviceId: 's', skillName: 'api', documents });
  const entry = files.get('SKILL.md');
  const start = entry.indexOf('description: ') + 'description: '.length;
  const description = entry.slice(start, entry.indexOf('\n---\n', start));
  assert.ok(description.length <= 1024, `description must stay within 1024 characters, got ${description.length}`);
  assert.ok(!description.includes(': '), 'description must stay a single YAML plain scalar');
  assert.ok(!description.includes('\n'), 'description must be one line');
  assert.ok(description.includes('…(+'), 'a truncated group list must be marked explicitly');
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

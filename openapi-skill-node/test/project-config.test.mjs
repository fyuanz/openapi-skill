import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, parse, resolve } from 'node:path';
import { test } from 'node:test';
import { loadConfig } from '../dist/index.js';

async function config(value) {
  const root = await mkdtemp(join(tmpdir(), 'openapi-skill-config-'));
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify(value));
  return loadConfig(root);
}

test('loads a multi-service project with api-docs defaults and normalized keywords', async () => {
  const loaded = await config({
    keywords: [' 接口文档 ', 'API', 'API'],
    services: [
      {
        serviceId: 'orders', sourceType: 'internal', keywords: ['交易', '订单'],
        documents: [{ id: 'public', url: 'http://orders.test/openapi', keywords: ['创建订单', '订单'] }]
      },
      {
        serviceId: 'shipping', sourceType: 'third-party', keywords: ['物流'],
        documents: [{ id: 'public', url: 'https://shipping.test/openapi', keywords: ['轨迹'] }]
      }
    ]
  });
  assert.equal(loaded.mode, 'project');
  assert.equal(loaded.skillName, 'api-docs');
  assert.deepEqual(loaded.keywords, ['API', '接口文档']);
  assert.deepEqual(loaded.services.map(({ serviceId }) => serviceId), ['orders', 'shipping']);
  assert.deepEqual(loaded.services[0].keywords, ['交易', '订单']);
  assert.deepEqual(loaded.services[0].documents[0].keywords, ['创建订单', '订单']);
  assert.match(loaded.output, /\.agents[\\/]skills$/);
  assert.deepEqual(loaded.outputs, [loaded.output]);
  assert.equal(loaded.timeoutMs, 30_000);
});

test('keeps string output compatible and resolves one to eight output paths in declaration order', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openapi-skill-config-output-'));
  const base = {
    services: [{ serviceId: 'svc', documents: [{ id: 'public', url: 'http://svc.test/openapi' }] }]
  };
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify({ ...base, output: '.codex/skills' }));
  const single = await loadConfig(root);
  assert.equal(single.output, resolve(root, '.codex/skills'));
  assert.deepEqual(single.outputs, [single.output]);

  const declared = ['.codex/skills', resolve(root, '.trae/skills'), '.agents/skills', 'one', 'two', 'three', 'four', 'five'];
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify({ ...base, output: declared }));
  const multiple = await loadConfig(root);
  assert.deepEqual(multiple.outputs, declared.map((path) => resolve(root, path)));
  assert.equal(multiple.output, multiple.outputs[0]);
});

test('rejects invalid, duplicate, root and nested output paths', async () => {
  const base = {
    services: [{ serviceId: 'svc', documents: [{ id: 'public', url: 'http://svc.test/openapi' }] }]
  };
  for (const output of [[], Array.from({ length: 9 }, (_, index) => `out-${index}`), ['valid', ''], ['valid', 42]]) {
    await assert.rejects(config({ ...base, output }), /output/);
  }
  await assert.rejects(config({ ...base, output: parse(resolve('.')).root }), /filesystem root/);
  await assert.rejects(config({ ...base, output: ['generated', './generated'] }), /duplicate output/);
  if (process.platform === 'win32') {
    await assert.rejects(config({ ...base, output: ['.codex/skills', '.CODEX/SKILLS'] }), /duplicate output/);
  }
  await assert.rejects(config({ ...base, output: ['.codex', '.codex/skills'] }), /nested output/);
});

test('keeps the legacy single-service configuration compatible', async () => {
  const loaded = await config({
    serviceId: 'legacy', skillName: 'legacy-api',
    documents: [{ id: 'public', url: 'http://legacy.test/openapi' }]
  });
  assert.equal(loaded.mode, 'legacy');
  assert.equal(loaded.skillName, 'legacy-api');
  assert.equal(loaded.services[0].serviceId, 'legacy');
});

test('rejects ambiguous services, invalid source types and unsafe keywords', async () => {
  await assert.rejects(config({ serviceId: 'legacy', documents: [], services: [] }), /cannot be combined/);
  await assert.rejects(config({ services: [
    { serviceId: 'same', documents: [{ id: 'a', url: 'http://a.test/openapi' }] },
    { serviceId: 'same', documents: [{ id: 'b', url: 'http://b.test/openapi' }] }
  ] }), /duplicate service id same/);
  await assert.rejects(config({ services: [
    { serviceId: 'vendor', sourceType: 'external', documents: [{ id: 'a', url: 'http://a.test/openapi' }] }
  ] }), /sourceType/);
  await assert.rejects(config({ keywords: ['line\nbreak'], services: [
    { serviceId: 'svc', documents: [{ id: 'a', url: 'http://a.test/openapi' }] }
  ] }), /keyword/);
  await assert.rejects(config({ services: [
    { serviceId: 'svc', documents: [{ id: 'a', url: 'http://a.test/openapi', keywords: Array.from({ length: 17 }, (_, i) => `k${i}`) }] }
  ] }), /at most 16 keywords/);
  await assert.rejects(config({ services: [
    { serviceId: 'svc', skillName: 'svc-api', documents: [{ id: 'a', url: 'http://a.test/openapi' }] }
  ] }), /one project produces one Skill/);
  await assert.rejects(config({ services: [
    { serviceId: 'svc', documents: [{ id: 'a', url: 'http://' }] }
  ] }), /invalid URL for svc\/a/);
});

test('allows document ids to repeat across services but keeps the project document budget', async () => {
  const loaded = await config({ services: [
    { serviceId: 'first', documents: [{ id: 'public', url: 'http://first.test/openapi' }] },
    { serviceId: 'second', documents: [{ id: 'public', url: 'http://second.test/openapi' }] }
  ] });
  assert.equal(loaded.services[0].sourceType, 'internal');
  assert.deepEqual(loaded.services.map((service) => service.documents[0].id), ['public', 'public']);

  const documents = Array.from({ length: 32 }, (_, i) => ({ id: `doc-${i}`, url: `http://first.test/${i}` }));
  await assert.rejects(config({ services: [
    { serviceId: 'first', documents },
    { serviceId: 'second', documents: [{ id: 'extra', url: 'http://second.test/openapi' }] }
  ] }), /at most 32 documents/);
});

test('loads project configuration from package.json openapiSkill', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openapi-skill-package-config-'));
  await writeFile(join(root, 'package.json'), JSON.stringify({ openapiSkill: {
    skillName: 'project-api', services: [
      { serviceId: 'orders', documents: [{ id: 'public', url: 'https://orders.test/openapi' }] }
    ]
  } }));
  const loaded = await loadConfig(root);
  assert.equal(loaded.mode, 'project');
  assert.equal(loaded.skillName, 'project-api');
});

test('loads local JSON document paths and resolves them from cwd', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openapi-skill-local-config-'));
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify({
    services: [
      {
        serviceId: 'local',
        documents: [
          { id: 'relative', url: './openapi/account.json' },
          { id: 'absolute', url: join(root, 'openapi', 'account.json') }
        ]
      }
    ]
  }));
  const loaded = await loadConfig(root);
  assert.equal(loaded.services[0].documents[0].kind, 'local');
  assert.equal(loaded.services[0].documents[0].path, resolve(root, 'openapi/account.json'));
  assert.equal(loaded.services[0].documents[1].kind, 'local');
  assert.equal(loaded.services[0].documents[1].path, resolve(root, 'openapi/account.json'));
});

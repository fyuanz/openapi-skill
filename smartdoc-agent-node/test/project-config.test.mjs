import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadConfig } from '../dist/index.js';

async function config(value) {
  const root = await mkdtemp(join(tmpdir(), 'smartdoc-config-'));
  await writeFile(join(root, 'smartdoc-agent.config.json'), JSON.stringify(value));
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
  assert.equal(loaded.timeoutMs, 30_000);
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

test('loads project configuration from package.json smartdocAgent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'smartdoc-package-config-'));
  await writeFile(join(root, 'package.json'), JSON.stringify({ smartdocAgent: {
    skillName: 'project-api', services: [
      { serviceId: 'orders', documents: [{ id: 'public', url: 'https://orders.test/openapi' }] }
    ]
  } }));
  const loaded = await loadConfig(root);
  assert.equal(loaded.mode, 'project');
  assert.equal(loaded.skillName, 'project-api');
});

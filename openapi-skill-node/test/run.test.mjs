import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { run } from '../dist/index.js';

test('downloads configured documents and publishes under .agents/skills by default', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'openapi-skill-node-'));
  const document = JSON.stringify({ openapi: '3.1.0', info: { version: '1' }, paths: {} });
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(document);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify({
    serviceId: 'demo', skillName: 'demo-api', documents: [
      { id: 'account', url: `http://127.0.0.1:${address.port}/v3/api-docs/account` },
      { id: 'business', url: `http://127.0.0.1:${address.port}/v3/api-docs/business` }
    ]
  }));
  const result = await run({ cwd: root });
  assert.equal(result.documentCount, 2);
  assert.equal(result.skillDirectory, join(root, '.agents', 'skills', 'demo-api'));
  assert.equal(JSON.parse(await readFile(join(result.skillDirectory, 'references', 'source.json'), 'utf8')).documents.length, 2);
});

test('does not replace an existing generated skill when a download fails', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'openapi-skill-node-failure-'));
  const output = join(root, 'generated');
  const document = JSON.stringify({ openapi: '3.1.0', paths: {} });
  const server = createServer((_request, response) => response.end(document));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  t.after(() => server.close());
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify({ serviceId: 'demo', skillName: 'demo-api', output, documents: [{ id: 'public', url: `http://127.0.0.1:${address.port}/openapi` }] }));
  await run({ cwd: root });
  const before = await readFile(join(output, 'demo-api', 'SKILL.md'), 'utf8');
  server.close();
  await assert.rejects(run({ cwd: root }));
  assert.equal(await readFile(join(output, 'demo-api', 'SKILL.md'), 'utf8'), before);
});

test('downloads all services into one default api-docs Skill and retains it atomically', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'openapi-skill-node-project-'));
  let revision = 1;
  let failShipping = false;
  let invalidShipping = false;
  const server = createServer((request, response) => {
    if (failShipping && request.url === '/shipping') { response.statusCode = 503; response.end(); return; }
    response.setHeader('content-type', 'application/json');
    if (invalidShipping && request.url === '/shipping') { response.end('{"openapi":"3.2.0","paths":{}}'); return; }
    response.end(JSON.stringify({ openapi: '3.1.0', info: { version: String(revision) }, paths: {} }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify({
    keywords: ['项目接口'], services: [
      { serviceId: 'orders', keywords: ['订单'], documents: [
        { id: 'public', url: `http://127.0.0.1:${address.port}/orders`, keywords: ['下单'] }
      ] },
      { serviceId: 'shipping', sourceType: 'third-party', keywords: ['物流'], documents: [
        { id: 'public', url: `http://127.0.0.1:${address.port}/shipping`, keywords: ['轨迹'] }
      ] }
    ]
  }));
  const result = await run({ cwd: root });
  assert.equal(result.serviceCount, 2);
  assert.equal(result.documentCount, 2);
  assert.equal(result.skillDirectory, join(root, '.agents', 'skills', 'api-docs'));
  assert.equal(JSON.parse(await readFile(join(result.skillDirectory, 'references', 'source.json'), 'utf8')).kind, 'project');
  const before = await readTree(result.skillDirectory);
  revision = 2; failShipping = true;
  await assert.rejects(run({ cwd: root }), /shipping\/public: DOWNLOAD: HTTP 503/);
  assert.deepEqual(await readTree(result.skillDirectory), before);
  failShipping = false; invalidShipping = true;
  await assert.rejects(run({ cwd: root }), /shipping\/public: UNSUPPORTED_VERSION/);
  assert.deepEqual(await readTree(result.skillDirectory), before);
});

async function readTree(root) {
  const files = new Map();
  async function walk(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(join(directory, entry.name), relative);
      else files.set(relative, await readFile(join(directory, entry.name), 'utf8'));
    }
  }
  await walk(root);
  return new Map([...files].sort(([a], [b]) => a.localeCompare(b, 'en')));
}

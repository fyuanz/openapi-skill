import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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

test('reads local JSON document paths and publishes a Skill', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openapi-skill-node-local-'));
  await mkdir(join(root, 'openapi'), { recursive: true });
  await writeFile(join(root, 'openapi', 'account.json'), JSON.stringify({ openapi: '3.1.0', info: { version: '1' }, paths: {} }));
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify({
    serviceId: 'demo', skillName: 'demo-api', documents: [{ id: 'account', url: './openapi/account.json' }]
  }));
  const result = await run({ cwd: root });
  assert.equal(result.documentCount, 1);
  assert.equal(result.skillDirectory, join(root, '.agents', 'skills', 'demo-api'));
  assert.equal(JSON.parse(await readFile(join(result.skillDirectory, 'references', 'source.json'), 'utf8')).documents.length, 1);
});

test('does not replace an existing generated skill when a local source fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openapi-skill-node-local-failure-'));
  const output = join(root, 'generated');
  await mkdir(join(root, 'openapi'), { recursive: true });
  const local = join(root, 'openapi', 'public.json');
  await writeFile(local, JSON.stringify({ openapi: '3.1.0', paths: {} }));
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify({ serviceId: 'demo', skillName: 'demo-api', output, documents: [{ id: 'public', url: './openapi/public.json' }] }));
  await run({ cwd: root });
  const before = await readFile(join(output, 'demo-api', 'SKILL.md'), 'utf8');
  await rm(local);
  await assert.rejects(run({ cwd: root }), /public: LOCAL:/);
  assert.equal(await readFile(join(output, 'demo-api', 'SKILL.md'), 'utf8'), before);
});

test('keeps a previous Skill when a local document exceeds the single-file limit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openapi-skill-node-local-limit-'));
  const output = join(root, 'generated');
  await mkdir(join(root, 'openapi'), { recursive: true });
  const small = join(root, 'openapi', 'small.json');
  const large = join(root, 'openapi', 'large.json');
  await writeFile(small, JSON.stringify({ openapi: '3.1.0', paths: {} }));
  await writeFile(large, Buffer.alloc(8 * 1024 * 1024 + 1, 32));
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify({ serviceId: 'demo', skillName: 'demo-api', output, documents: [{ id: 'small', url: './openapi/small.json' }] }));
  await run({ cwd: root });
  const before = await readFile(join(output, 'demo-api', 'SKILL.md'), 'utf8');
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify({ serviceId: 'demo', skillName: 'demo-api', output, documents: [{ id: 'large', url: './openapi/large.json' }] }));
  await assert.rejects(run({ cwd: root }), /large: (LIMIT|LOCAL)/);
  assert.equal(await readFile(join(output, 'demo-api', 'SKILL.md'), 'utf8'), before);
});

test('rejects local document input above the project byte limit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openapi-skill-node-local-project-limit-'));
  await mkdir(join(root, 'openapi'), { recursive: true });
  const prefix = Buffer.from('{"openapi":"3.1.0","paths":{}}');
  const fullDocument = Buffer.concat([prefix, Buffer.alloc(8 * 1024 * 1024 - prefix.byteLength, 32)]);
  const documents = [];
  for (let index = 0; index < 4; index += 1) {
    const id = `full-${index}`;
    await writeFile(join(root, 'openapi', `${id}.json`), fullDocument);
    documents.push({ id, url: `./openapi/${id}.json` });
  }
  await writeFile(join(root, 'openapi', 'extra.json'), JSON.stringify({ openapi: '3.1.0', paths: {} }));
  documents.push({ id: 'extra', url: './openapi/extra.json' });
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify({
    serviceId: 'demo', skillName: 'demo-api', documents
  }));
  await assert.rejects(run({ cwd: root }), /LIMIT: project input bytes exceeded/);
});

test('rejects an unsupported local OpenAPI version without replacing the Skill', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openapi-skill-node-local-version-'));
  const output = join(root, 'generated');
  await mkdir(join(root, 'openapi'), { recursive: true });
  const local = join(root, 'openapi', 'public.json');
  await writeFile(local, JSON.stringify({ openapi: '3.1.0', paths: {} }));
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify({ serviceId: 'demo', skillName: 'demo-api', output, documents: [{ id: 'public', url: './openapi/public.json' }] }));
  await run({ cwd: root });
  const before = await readFile(join(output, 'demo-api', 'SKILL.md'), 'utf8');
  await writeFile(local, JSON.stringify({ openapi: '3.2.0', paths: {} }));
  await assert.rejects(run({ cwd: root }), /public: UNSUPPORTED_VERSION/);
  assert.equal(await readFile(join(output, 'demo-api', 'SKILL.md'), 'utf8'), before);
});

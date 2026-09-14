import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { run } from '../dist/index.js';

test('downloads configured documents and publishes under .agents/skills by default', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'smartdoc-node-'));
  const document = JSON.stringify({ openapi: '3.1.0', info: { version: '1' }, paths: {} });
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(document);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  await writeFile(join(root, 'smartdoc-agent.config.json'), JSON.stringify({
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
  const root = await mkdtemp(join(tmpdir(), 'smartdoc-node-failure-'));
  const output = join(root, 'generated');
  const document = JSON.stringify({ openapi: '3.1.0', paths: {} });
  const server = createServer((_request, response) => response.end(document));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  t.after(() => server.close());
  await writeFile(join(root, 'smartdoc-agent.config.json'), JSON.stringify({ serviceId: 'demo', skillName: 'demo-api', output, documents: [{ id: 'public', url: `http://127.0.0.1:${address.port}/openapi` }] }));
  await run({ cwd: root });
  const before = await readFile(join(output, 'demo-api', 'SKILL.md'), 'utf8');
  server.close();
  await assert.rejects(run({ cwd: root }));
  assert.equal(await readFile(join(output, 'demo-api', 'SKILL.md'), 'utf8'), before);
});

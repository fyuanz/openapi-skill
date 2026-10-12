import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as api from '../dist/index.js';

const paths = Object.fromEntries(Array.from({ length: 24 }, (_, i) => [`/items/${i}`, { get: {
  summary: i === 7 ? '查询用户' : '查询条目', operationId: 'read' + i, tags: ['条目'], responses: {}
} }]));
const documents = new Map([['public', Buffer.from(JSON.stringify({ openapi: '3.1.0', paths }))]]);
const files = () => api.generateProjectSkill({ services: ['one', 'two'].map(serviceId => ({ serviceId, documents, keywords: ['用户'] })) });

test('local search ranks exact identities and endpoint terms above broad scope keywords', () => {
  const tree = files();
  assert.equal(typeof api.searchSkill, 'function');
  const exact = api.searchSkill(tree, { query: 'GET /items/7' });
  assert.equal(exact.total, 2); assert.ok(exact.results.every(x => x.path === '/items/7'));
  const operationId = api.searchSkill(tree, { query: 'read7', service: 'two' });
  assert.equal(operationId.total, 1); assert.equal(operationId.results[0].serviceId, 'two');
  const business = api.searchSkill(tree, { query: '用户', limit: 3 });
  assert.equal(business.total, 48); assert.equal(business.results.length, 3); assert.equal(business.hasMore, true);
  assert.ok(business.results.slice(0, 2).every(x => x.path === '/items/7'));
  assert.equal(api.searchSkill(tree, { query: '用户 不存在' }).total, 0);
});

test('pagination is complete, deterministic and filtered without reading operation contracts', () => {
  const tree = files();
  for (const key of tree.keys()) if (/references\/(operations|schemas)\//.test(key)) tree.delete(key);
  const all = [];
  for (let offset = 0; offset < 24; offset += 5) {
    const page = api.searchSkill(tree, { query: '用户', service: 'one', document: 'public', offset, limit: 5 });
    assert.equal(page.total, 24); all.push(...page.results.map(x => x.id));
  }
  assert.equal(all.length, 24); assert.equal(new Set(all).size, 24);
  for (const options of [{ query: '' }, { query: 'x', limit: 101 }, { query: 'x', offset: -1 }, { query: 'x', limit: 1.5 }])
    assert.throws(() => api.searchSkill(tree, options), /CONFIG/);
});

test('search bounds long summary previews without losing tail matches or changing source contracts', () => {
  const summary = '🚁'.repeat(159) + '查询航线尾部';
  const tree = api.generateProjectSkill({ services: [{ serviceId: 'demo', documents: new Map([
    ['public', Buffer.from(JSON.stringify({ openapi: '3.1.0', paths: {
      '/long': { get: { summary, responses: {} } },
      '/short': { get: { summary: '🚁'.repeat(160), responses: {} } }
    } }))]
  ]) }] });
  const snapshot = [...tree];
  const page = api.searchSkill(tree, { query: '查询航线尾部' });
  assert.equal(page.total, 1);
  assert.equal(page.results[0].summary, '🚁'.repeat(159) + '…');
  assert.equal([...page.results[0].summary].length, 160);
  assert.equal(page.results[0].summaryTruncated, true);
  assert.ok(tree.get(page.results[0].file).includes(summary));
  assert.deepEqual([...tree], snapshot);
  const short = api.searchSkill(tree, { query: 'GET /short' }).results[0];
  assert.equal(short.summary, '🚁'.repeat(160));
  assert.equal(Object.hasOwn(short, 'summaryTruncated'), false);
});

test('old v4 indexes work while malformed, duplicate and unsafe paths fail explicitly', () => {
  const tree = files();
  const rows = tree.get('references/operations.jsonl').trim().split('\n').map(JSON.parse);
  for (const row of rows) { delete row.aliases; delete row.requestFiles; delete row.responseFiles; }
  tree.set('references/operations.jsonl', rows.map(JSON.stringify).join('\n') + '\n');
  assert.equal(api.searchSkill(tree, { query: 'GET /items/7' }).total, 2);
  for (const content of ['{', JSON.stringify(rows[0]) + '\n' + JSON.stringify(rows[0]), JSON.stringify({ ...rows[0], file: '../secret.md' })]) {
    const bad = new Map(tree); bad.set('references/operations.jsonl', content);
    assert.throws(() => api.searchSkill(bad, { query: '用户' }), /OUTPUT/);
  }
});

test('search CLI returns JSON, distinguishes usage errors and never triggers generation', async t => {
  const root = await mkdtemp(join(tmpdir(), 'skill-search-')); t.after(() => rm(root, { recursive: true, force: true }));
  const directory = await api.publishSkill(root, 'api-docs', 'api-docs', files());
  const cli = new URL('../dist/cli.js', import.meta.url);
  const args = [fileURLToPath(cli), 'search', 'GET /items/7', '--skill', directory, '--service', 'two'];
  const result = JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8', cwd: root }));
  assert.equal(result.total, 1); assert.equal(result.results[0].serviceId, 'two');
  const bad = spawnSync(process.execPath, [...args, '--limit', '0'], { encoding: 'utf8' });
  assert.equal(bad.status, 2); assert.equal(bad.stdout, '');
  await writeFile(join(directory, 'references/operations.jsonl'), '{');
  const broken = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(broken.status, 1); assert.equal(broken.stdout, ''); assert.doesNotMatch(broken.stderr, /at .*\.js:/);
});

import assert from 'node:assert/strict';
import { readFile, mkdtemp, readdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { generateSkill, generateProjectSkill, publishSkill, run } from '../dist/index.js';

const fixture = await readFile(new URL('../../openapi-skill-core/src/test/resources/catalog-discovery.json', import.meta.url));
const empty = Buffer.from('{"openapi":"3.1.0","paths":{}}');
const documents = new Map([['business', fixture], ['empty', empty]]);
const project = () => generateProjectSkill({services: ['files', 'other'].map(serviceId => ({serviceId, documents}))});

function checkEntries(index) {
  for (const value of ['上传文件', 'uploadFile', 'POST /files', 'DELETE /files/{id}', 'GET /health', '附件', 'untagged', '文件管理', 'No operations are documented.'])
    assert.ok(index.includes(value), `missing ${value}`);
  assert.ok(!index.includes('[run](outside.md)'));
  assert.ok(!index.includes('<script>'));
  const unsafe = index.split('\n').find(line => line.includes('GET /unsafe'));
  assert.ok(unsafe.includes('operationId=duplicate'));
  assert.ok(!index.includes('```json'));
}

test('one flat index exposes complete scoped actions without configured keywords', () => {
  const files = project();
  checkEntries(files.get('references/index.md'));
  for (const id of ['files', 'other']) {
    assert.ok(files.get('references/index.md').includes(`service=${id}`));
    assert.ok(files.get(`references/operations/${id}--business--post-files.md`).includes('https://files.example'));
  }
  assert.equal(files.get('references/index.md').split('POST /files').length - 1, 2);
  checkEntries(generateSkill({serviceId: 'files', skillName: 'files-api', documents}).get('references/index.md'));
});

test('navigation goes directly from the index to the operation and source text stays outside instructions', async (t) => {
  const files = project();
  const entry = files.get('SKILL.md');
  assert.match(entry, /references\/index.md/);
  assert.match(entry, /multiple candidates/i);
  assert.match(entry, /broaden keywords and service\/document scope/);
  assert.ok(!entry.includes('IGNORE_INSTRUCTIONS'));
  assert.ok(files.get('references/index.md').includes('](operations/files--business--post-files.md)'));
  assert.ok(files.get('references/operations/files--business--post-files.md').includes('uploadFile'));
  const root = await mkdtemp(join(tmpdir(), 'index-links-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  await publishSkill(root, 'api-docs', 'api-docs', files); // validates every generated link and the complete tree
});

test('same-named document actions remain separate and input ordering is stable', () => {
  const root = JSON.parse(fixture);
  root.paths = Object.fromEntries(Object.entries(root.paths).reverse());
  const docs = new Map([['second', fixture], ['business', Buffer.from(JSON.stringify(root))], ['empty', empty]]);
  const a = generateSkill({serviceId: 'files', skillName: 'files-api', documents: docs});
  const b = generateSkill({serviceId: 'files', skillName: 'files-api', documents: new Map([['empty', empty], ['business', fixture], ['second', fixture]])});
  assert.equal(a.get('references/index.md'), b.get('references/index.md'));
  assert.equal(a.get('references/index.md').split('POST /files').length - 1, 2);
  const services = ['z', 'a'].map(serviceId => ({serviceId, documents}));
  assert.equal(generateProjectSkill({services}).get('references/index.md'), generateProjectSkill({services: services.reverse()}).get('references/index.md'));
});

test('project index includes document keywords and all operations in a large document', () => {
  const paths = Object.fromEntries(Array.from({length: 124}, (_, i) => [`/items/${i}`, {get: {summary: `动作${i}`, tags: [`分组${i % 19}`], responses: {}}}]));
  const docs = new Map([['business', Buffer.from(JSON.stringify({openapi: '3.1.0', paths}))]]);
  const files = generateProjectSkill({services: [{serviceId: 'files', documents: docs, documentKeywords: new Map([['business', ['模块别名']]])}]});
  for (const path of ['references/index.md']) {
    const index = files.get(path);
    assert.ok(index.includes('模块别名'));
    assert.equal(index.split('GET /items/').length - 1, 124);
    console.log(`${path}: ${Buffer.byteLength(index)} bytes, 124 operations`);
  }
});

test('index expansion beyond the output budget fails without replacing the previous tree', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'index-budget-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const services = Array.from({length: 5}, (_, i) => ({serviceId: `svc-${i}`, documents: [{id: 'public', url: './api.json'}]}));
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify({services}));
  await writeFile(join(root, 'api.json'), fixture);
  const result = await run({cwd: root});
  const snapshot = async () => {
    const names = (await readdir(result.skillDirectory, {recursive: true, withFileTypes: true})).filter(e => e.isFile());
    return Promise.all(names.map(async e => [join(e.parentPath, e.name), await readFile(join(e.parentPath, e.name), 'utf8')]));
  };
  const before = await snapshot();
  await writeFile(join(root, 'api.json'), JSON.stringify({openapi: '3.1.0', paths: {'/large': {get: {summary: 'x'.repeat(3 * 1024 * 1024), responses: {}}}}}));
  await assert.rejects(run({cwd: root}), /LIMIT.*output/);
  assert.deepEqual(await snapshot(), before);
});

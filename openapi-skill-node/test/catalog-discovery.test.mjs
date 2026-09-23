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

function checkEntries(catalog) {
  for (const value of ['上传文件', 'uploadFile', 'POST /files', 'DELETE /files/{id}', 'GET /health', '附件', 'untagged', '文件管理', '2 interface(s)', 'No operations are documented.'])
    assert.ok(catalog.includes(value), `missing ${value}`);
  assert.ok(!catalog.includes('[run](outside.md)'));
  assert.ok(!catalog.includes('<script>'));
  const unsafe = catalog.split('\n').find(line => line.includes('GET /unsafe'));
  assert.equal(unsafe.split('duplicate').length - 1, 1);
  assert.ok(!catalog.includes('```json'));
}

test('both catalogs expose complete scoped actions without configured keywords', () => {
  const files = project();
  checkEntries(files.get('references/catalog.md'));
  for (const id of ['files', 'other']) {
    const member = files.get(`references/services/${id}/references/catalog.md`);
    checkEntries(member);
    assert.equal(member.split('<!-- openapi-skill:interface-discovery -->').length - 1, 1,
      'service discovery uses the shared marker so Java aggregation can refresh it without duplication');
    assert.ok(member.includes('https://files.example'));
    assert.ok(member.includes('documents/business/context.md'));
  }
  assert.equal(files.get('references/catalog.md').split('POST /files').length - 1, 2);
  const single = generateSkill({serviceId: 'files', skillName: 'files-api', documents});
  checkEntries(single.get('references/catalog.md'));
});

test('navigation follows both catalogs then context and source text stays outside instructions', async (t) => {
  const files = project();
  const entry = files.get('SKILL.md');
  assert.match(entry, /service catalog.*context/s);
  assert.match(entry, /multiple candidates/i);
  assert.match(entry, /other.*documents.*groups/s);
  assert.ok(!entry.includes('IGNORE_INSTRUCTIONS'));
  let path = 'references/catalog.md';
  for (const fragment of ['services/files/references/catalog.md', 'documents/business/context.md', 'groups/文件管理.md', '../operations/post-files.md']) {
    assert.ok(files.get(path).includes(`](${fragment})`), `${path} -> ${fragment}`);
    path = decodeURIComponent(new URL(fragment, `file:///${path}`).pathname.slice(1));
  }
  assert.ok(files.get(path).includes('uploadFile'));
  const root = await mkdtemp(join(tmpdir(), 'catalog-links-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  await publishSkill(root, 'api-docs', 'api-docs', files); // validates every generated link and the complete tree
});

test('same-named document actions remain separate and input ordering is stable', () => {
  const root = JSON.parse(fixture);
  root.paths = Object.fromEntries(Object.entries(root.paths).reverse());
  const docs = new Map([['second', fixture], ['business', Buffer.from(JSON.stringify(root))], ['empty', empty]]);
  const a = generateSkill({serviceId: 'files', skillName: 'files-api', documents: docs});
  const b = generateSkill({serviceId: 'files', skillName: 'files-api', documents: new Map([['empty', empty], ['business', fixture], ['second', fixture]])});
  assert.equal(a.get('references/catalog.md'), b.get('references/catalog.md'));
  assert.equal(a.get('references/catalog.md').split('POST /files').length - 1, 2);
  const services = ['z', 'a'].map(serviceId => ({serviceId, documents}));
  assert.equal(generateProjectSkill({services}).get('references/catalog.md'), generateProjectSkill({services: services.reverse()}).get('references/catalog.md'));
});

test('project catalog includes document keywords and all operations in a large document', () => {
  const paths = Object.fromEntries(Array.from({length: 124}, (_, i) => [`/items/${i}`, {get: {summary: `动作${i}`, tags: [`分组${i % 19}`], responses: {}}}]));
  const docs = new Map([['business', Buffer.from(JSON.stringify({openapi: '3.1.0', paths}))]]);
  const files = generateProjectSkill({services: [{serviceId: 'files', documents: docs, documentKeywords: new Map([['business', ['模块别名']]])}]});
  for (const path of ['references/catalog.md', 'references/services/files/references/catalog.md']) {
    const catalog = files.get(path);
    assert.ok(catalog.includes('模块别名'));
    assert.equal(catalog.split('GET /items/').length - 1, 124);
    console.log(`${path}: ${Buffer.byteLength(catalog)} bytes, 124 operations`);
  }
});

test('catalog expansion beyond the output budget fails without replacing the previous tree', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'catalog-budget-'));
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

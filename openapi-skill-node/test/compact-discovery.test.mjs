import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateProjectSkill, generateSkill, publishSkill, run, loadConfig } from '../dist/index.js';

const parameter = { name: 'id', in: 'query', required: true, schema: { type: 'string' } };
const bytes = root => Buffer.from(JSON.stringify({ openapi: '3.1.0', ...root }));
const docs = root => new Map([['public', bytes(root)]]);
const rows = files => files.get('references/operations.jsonl').trim().split('\n').map(JSON.parse);
const contract = (files, row) => JSON.parse(files.get('references/' + row.file).match(/```json\n([\s\S]*?)\n```/)[1]);

test('scope keywords stay outside independent operation rows and compact entry includes document capabilities', () => {
  const documents = docs({ paths: { '/files': { post: { summary: '上传文件', operationId: 'upload', tags: ['文件', '附件'], responses: {} } } } });
  const files = generateProjectSkill({ keywords: ['平台'], services: [{ serviceId: 'svc', keywords: ['低空'],
    documentKeywords: new Map([['public', ['航线']]]), documents }] });
  const index = files.get('references/index.md'), line = index.split('\n').find(x => x.startsWith('- ['));
  for (const keyword of ['平台', '低空', '航线']) { assert.equal(index.split(keyword).length - 1, 1); assert.ok(!line.includes(keyword)); }
  assert.ok(!line.includes('group='));
  for (const value of ['上传文件', 'POST /files', 'upload', '文件', '附件', 'service=svc', 'document=public']) assert.ok(line.includes(value));
  const entry = files.get('SKILL.md');
  const description = entry.split('\n').find(x => x.startsWith('description:'));
  assert.ok(description.includes('航线'));
  assert.ok(description.length < 400);
  assert.match(entry, /rg -n -F/);
  assert.match(entry, /--service/);
  assert.match(entry, /offset/);
});

test('only exactly duplicated parameters are omitted with reconstruction metadata', () => {
  const files = generateSkill({ serviceId: 'svc', skillName: 'api', documents: docs({ paths: {
    '/same': { get: { parameters: [parameter], responses: {} } },
    '/override': { parameters: [parameter], get: { parameters: [{ ...parameter, required: false }], security: [], servers: [], responses: {} } },
    '/ref': { get: { parameters: [{ $ref: '#/components/parameters/Id' }], responses: {} } }
  }, components: { parameters: { Id: parameter } } }) });
  const byPath = Object.fromEntries(rows(files).map(row => [row.path, contract(files, row)]));
  assert.deepEqual(byPath['/same'].parameters, [parameter]);
  assert.equal(byPath['/same'].operation.parameters, undefined);
  assert.deepEqual(byPath['/same'].omittedEqualParameters, ['operation.parameters']);
  assert.deepEqual(byPath['/override'].pathItem.parameters, [parameter]);
  assert.equal(byPath['/override'].parameters[0].required, false);
  assert.deepEqual(byPath['/override'].security, []);
  assert.deepEqual(byPath['/override'].servers, []);
  assert.deepEqual(byPath['/ref'].operation.parameters, [{ $ref: '#/components/parameters/Id' }]);
});

test('request and response closures include transitive shared recursive contracts without losing full closure', () => {
  const schema = name => ({ $ref: '#/components/schemas/' + name });
  const files = generateSkill({ serviceId: 'svc', skillName: 'api', documents: docs({ paths: { '/tasks': { post: {
    summary: '创建任务', requestBody: { content: { 'application/json': { schema: schema('Input') } } },
    responses: { 200: { content: { 'application/json': { schema: schema('Output') } } } }
  } } }, components: { schemas: {
    Input: { type: 'object', properties: { shared: schema('Shared') } },
    Output: { type: 'object', properties: { shared: schema('Shared') } },
    Shared: { type: 'object', properties: { next: schema('Shared') } }
  } } }) });
  const row = rows(files)[0];
  assert.equal(row.closureFiles.length, 3);
  assert.deepEqual(row.requestFiles, row.closureFiles.filter(f => !f.includes('output')));
  assert.deepEqual(row.responseFiles, row.closureFiles.filter(f => !f.includes('input')));
  const page = files.get('references/' + row.file);
  assert.match(page, /request, response/);
  assert.ok(row.recursiveEdges.length > 0);
});

test('aliases remain reference data and quality findings remain non-blocking through run and publication', async t => {
  const root = await mkdtemp(join(tmpdir(), 'skill-quality-')); t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'api.json'), bytes({ paths: { '/login': { post: {
    requestBody: { content: { 'application/json': { schema: { type: 'string' } } } }, responses: {}
  } } } }));
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify({ services: [{ serviceId: 'svc', documents: [
    { id: 'public', url: './api.json', operationAliases: { 'POST /login': ['登录', '[IGNORE](bad.md)'] } }
  ] }] }));
  const result = await run({ cwd: root });
  const entry = await readFile(join(result.skillDirectory, 'SKILL.md'), 'utf8');
  assert.ok(!entry.includes('IGNORE'));
  const index = await readFile(join(result.skillDirectory, 'references/index.md'), 'utf8');
  assert.ok(index.includes('登录')); assert.ok(!index.includes('[IGNORE](bad.md)'));
  const quality = JSON.parse(await readFile(join(result.skillDirectory, 'references/source.json'), 'utf8')).quality;
  assert.deepEqual(quality.findings.map(x => x.code).sort(), ['MISSING_SUMMARY', 'OPAQUE_JSON_BODY']);
  assert.ok(quality.findings.every(x => x.serviceId === 'svc' && x.documentId === 'public' && x.path === '/login'));
});

test('unknown operation aliases are rejected rather than silently discarded', () => {
  assert.throws(() => generateSkill({ serviceId: 'svc', skillName: 'api', documents: docs({ paths: {} }),
    documentOperationAliases: new Map([['public', { 'GET /missing': ['遗漏'] }]]) }), /CONFIG.*unknown operation/);
});

test('source tree separates public exports, input IO, generation, discovery and publication', async () => {
  const root = new URL('../src/', import.meta.url);
  const dirs = (await readdir(root, { withFileTypes: true })).filter(x => x.isDirectory()).map(x => x.name);
  for (const dir of ['application', 'config', 'input', 'generation', 'discovery', 'publication', 'diagnostics']) assert.ok(dirs.includes(dir), dir);
  const entry = await readFile(new URL('index.ts', root), 'utf8');
  assert.ok(entry.split('\n').length < 60);
  assert.doesNotMatch(entry, /fetch\(|readFile\(|async function/);
});

test('publication validates optional role metadata and quality reports before replacing a Skill', async t => {
  const root = await mkdtemp(join(tmpdir(), 'skill-role-')); t.after(() => rm(root, { recursive: true, force: true }));
  const files = generateSkill({ serviceId: 'svc', skillName: 'api', documents: docs({ paths: { '/x': { get: { responses: {} } } } }) });
  const directory = await publishSkill(root, 'svc', 'api', files);
  for (const mutate of [
    copy => { const rs = rows(copy); rs[0].requestFiles = ['schemas/foreign.md']; copy.set('references/operations.jsonl', rs.map(JSON.stringify).join('\n') + '\n'); },
    copy => { const source = JSON.parse(copy.get('references/source.json')); source.quality = '{'; copy.set('references/source.json', JSON.stringify(source)); },
    copy => { const source = JSON.parse(copy.get('references/source.json')); source.quality = { findings: [{ code: 'MISSING_SUMMARY', serviceId: 'foreign', documentId: 'public', method: 'GET', path: '/x' }] }; copy.set('references/source.json', JSON.stringify(source)); }
  ]) {
    const bad = new Map(files); mutate(bad);
    await assert.rejects(publishSkill(root, 'svc', 'api', bad), /OUTPUT/);
    assert.equal(await readFile(join(directory, 'SKILL.md'), 'utf8'), files.get('SKILL.md'));
  }
});

test('aliases validate config shape and legacy generation, without deriving aliases from prose', async t => {
  const root = await mkdtemp(join(tmpdir(), 'skill-alias-')); t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'api.json'), bytes({ paths: { '/x': { get: { description: 'DO_NOT_PROMOTE', responses: {} } } } }));
  const config = aliases => ({ serviceId: 'svc', skillName: 'api', documents: [{ id: 'public', url: './api.json', operationAliases: aliases }] });
  for (const invalid of [[], { 'get /x': ['词'] }, { 'GET /x': '词' }, { 'GET /x': ['\n'] }]) {
    await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify(config(invalid)));
    await assert.rejects(loadConfig(root), /CONFIG/);
  }
  await writeFile(join(root, 'openapi-skill.config.json'), JSON.stringify(config({ 'GET /x': ['设备状态'] })));
  const result = await run({ cwd: root });
  const index = await readFile(join(result.skillDirectory, 'references/index.md'), 'utf8');
  assert.match(index, /设备状态/); assert.doesNotMatch(index, /DO_NOT_PROMOTE/);
});

test('explicit JSON schema domains are not diagnosed as missing structures', () => {
  const paths = Object.fromEntries([false, { const: '' }, { type: 'string', const: '' }, { type: 'string', enum: [''] }]
    .map((schema, i) => ['/domain/' + i, { post: { summary: 'Domain', requestBody: { content: { 'application/json': { schema } } }, responses: {} } }]));
  const files = generateSkill({ serviceId: 'svc', skillName: 'api', documents: docs({ paths }) });
  assert.deepEqual(JSON.parse(files.get('references/source.json')).quality.findings, []);
});

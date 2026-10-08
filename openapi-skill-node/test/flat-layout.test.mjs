import assert from 'node:assert/strict';
import { test } from 'node:test';
import { posix } from 'node:path';
import { generateSkill, generateProjectSkill } from '../dist/index.js';
import { publishSkill } from '../dist/publisher.js';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const input = new TextEncoder().encode(JSON.stringify({
  openapi: '3.1.0', servers: [{ url: 'https://example.test' }], security: [{ token: [] }],
  paths: { '/files': { post: { summary: '上传文件\n[link](bad.md)', operationId: 'upload', tags: ['文件', '附件'],
    requestBody: { $ref: '#/components/requestBodies/Upload' }, responses: {} } } },
  components: {
    requestBodies: { Upload: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Node' } } } } },
    schemas: { Node: { type: 'object', description: '[literal](bad.md)', properties: { next: { $ref: '#/components/schemas/Node' } } } },
    securitySchemes: { token: { type: 'http', scheme: 'bearer' } }
  }
}));
const documents = new Map([['public', input]]);
const rows = (files) => files.get('references/operations.jsonl').trim().split('\n').map(JSON.parse);

function check(files, count) {
  assert.equal(JSON.parse(files.get('references/source.json')).generatorVersion, 'openapi-skill-core/4');
  assert.ok([...files.keys()].every(path => path.split('/').length <= 3));
  assert.ok(![...files.keys()].some(path => /catalog|context|groups\//.test(path)));
  const index = files.get('references/index.md');
  assert.equal(index.split('\n').filter(line => line.startsWith('- [')).length, count);
  for (const row of rows(files)) {
    assert.ok(index.includes(`](${row.file})`));
    const line = index.split('\n').find(line => line.includes(`](${row.file})`));
    for (const value of ['上传文件', 'POST /files', `service=${row.serviceId}`, 'document=public', '附件', 'upload'])
      assert.ok(line.includes(value), value);
    const contract = files.get(`references/${row.file}`);
    assert.match(contract, /https:\/\/example.test/);
    for (const target of row.closureFiles) assert.ok(files.has(`references/${target}`));
  }
  for (const [path, content] of files) {
    if (!path.endsWith('.md')) continue;
    let fenced = false;
    for (const line of content.split('\n')) {
      if (line.trimStart().startsWith('```')) { fenced = !fenced; continue; }
      if (fenced) continue;
      for (const match of line.matchAll(/\]\(([^)]+)\)/g))
        assert.ok(files.has(posix.normalize(posix.join(posix.dirname(path), match[1]))), `${path}: ${match[1]}`);
    }
  }
  assert.match(files.get('SKILL.md'), /references\/index.md/);
  assert.doesNotMatch(files.get('SKILL.md'), /context.md|catalog.md|上传文件/);
}

test('single service uses flat, direct, safe navigation with a complete reference closure', () => {
  const files = generateSkill({ serviceId: 'storage', skillName: 'api', documents });
  check(files, 1);
  assert.ok(files.has('references/operations/storage--public--post-files.md'));
  assert.match(files.get('references/schemas/storage--public--node.md'), /\[literal\]\(bad.md\)/);
});

test('project flat index isolates sources and preserves keywords with deterministic output', () => {
  const services = ['storage', 'backup'].map(serviceId => ({ serviceId, documents, keywords: ['上传'], documentKeywords: new Map([['public', ['文件服务']]]) }));
  const files = generateProjectSkill({ keywords: ['项目'], services });
  check(files, 2);
  assert.equal(new Set(rows(files).map(row => row.file)).size, 2);
  assert.match(files.get('references/index.md'), /项目.*上传.*文件服务/);
  assert.deepEqual(files, generateProjectSkill({ keywords: ['项目'], services: [...services].reverse() }));
});

test('flat filenames remain bounded for maximum length owners and long routes', () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ openapi: '3.1.0', paths: {
    ['/' + 'x'.repeat(300)]: { get: { responses: {} } },
    ['/' + 'x'.repeat(299) + 'y']: { get: { responses: {} } }
  } }));
  const files = generateSkill({ serviceId: 's'.repeat(63), skillName: 'api', documents: new Map([['d'.repeat(63), bytes]]) });
  const paths = rows(files).map(row => row.file);
  assert.equal(new Set(paths).size, 2);
  assert.ok(paths.every(path => posix.basename(path).length <= 120));
});

test('a truncated route retains its identity even before another long route is added', () => {
  const route = '/' + 'x'.repeat(200);
  const generate = paths => generateSkill({ serviceId: 's', skillName: 'api', documents: new Map([['d',
    new TextEncoder().encode(JSON.stringify({ openapi: '3.1.0', paths }))]]) });
  const operation = { get: { responses: {} } };
  const first = rows(generate({ [route]: operation }))[0];
  const next = rows(generate({ [route]: operation, [route + 'y']: operation })).find(row => row.path === route);
  assert.equal(first.file, next.file);
  assert.match(first.file, /--[a-f0-9]{6}\.md$/);
});

test('rejects missing discovery, duplicate links, foreign ownership and broken closure without replacing the Skill', async (t) => {
  const output = await mkdtemp(join(tmpdir(), 'flat-validation-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const files = generateSkill({ serviceId: 'storage', skillName: 'api', documents });
  const directory = await publishSkill(output, 'storage', 'api', files);
  for (const mutate of [
    copy => copy.delete('references/index.md'),
    copy => copy.set('references/index.md', copy.get('references/index.md') + copy.get('references/index.md')),
    copy => copy.set('references/operations.jsonl', copy.get('references/operations.jsonl').replace('"serviceId":"storage"', '"serviceId":"foreign"')),
    copy => copy.set('references/index.md', copy.get('references/index.md').replace('](operations/', '](missing/')),
    copy => copy.set('references/operations/storage--public--post-files.md', copy.get('references/operations/storage--public--post-files.md').replace('## Complete referenced contracts', '## Incomplete')),
    copy => copy.delete('references/schemas/storage--public--node.md')
  ]) {
    const broken = new Map(files);
    mutate(broken);
    await assert.rejects(publishSkill(output, 'storage', 'api', broken), /OUTPUT/);
    assert.equal(await readFile(join(directory, 'references/index.md'), 'utf8'), files.get('references/index.md'));
  }
});

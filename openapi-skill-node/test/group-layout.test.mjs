import assert from 'node:assert/strict';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { generateSkill } from '../dist/index.js';
import { publishSkill } from '../dist/publisher.js';
import { tagFiles } from '../dist/references.js';

const encoder = new TextEncoder();

const document = () => encoder.encode(JSON.stringify({
  openapi: '3.1.0',
  info: { title: 'UAV Hub 无人机云平台接口文档', version: '5.6.2' },
  servers: [{ url: 'http://192.168.1.52:8071', description: 'Generated server url' }],
  security: [{ Authorization: [], ClientId: [] }],
  tags: [
    { name: '航线任务', description: '航线任务管理' },
    { name: '设备管理', description: '设备列表、状态查询' },
    { name: '设备管理', description: '设备同步、列表查询、行政区挂载' },
    { name: '航线图形合规校验', description: '工单创建前航线/图形合规校验与 SHP 上传' }
  ],
  paths: {
    '/drone/task/create-local': { post: { tags: ['航线任务'], summary: '创建本地航线任务（仅插入本地job表，不调用司空SDK）', operationId: 'createLocalJob', responses: {} } },
    '/drone/task/page': { post: { tags: ['航线任务'], summary: '分页查询任务列表', operationId: 'pageQuery', responses: {} } },
    '/drone/device/list': { get: { tags: ['设备管理'], summary: 'GET /drone/device/list', operationId: 'getDeviceList', responses: {} } },
    '/drone/task/preview': { post: { tags: ['航线任务', '工单管理'], summary: '智能规划/航线预览', operationId: 'preview', responses: {} } },
    '/drone/task/check/wayline': { post: { tags: ['航线图形合规校验'], summary: '校验已有航线是否合规', operationId: 'checkWayline', responses: {} } },
    '/drone/ping': { get: { summary: '无标签接口', operationId: 'ping', responses: {} } },
    '/drone/terra/reconstruction/model-file/{fileId}': { delete: { tags: ['Terra重建管理'], summary: '删除Terra模型文件（调SDK删除）', operationId: 'deleteModelFile', responses: {} } },
    '/drone/terra/reconstruction/quality-report/{id}': { post: { tags: ['Terra重建管理'], summary: '获取重建精度报告下载链接', operationId: 'getQualityReport', responses: {} } },
    '/drone/wayline/recommended-dock/{waylineUuid}': { get: { tags: ['Terra重建管理'], summary: '根据航线自动推荐最近的机场', operationId: 'getRecommendedDock', responses: {} } }
  },
  components: {
    securitySchemes: {
      Authorization: { type: 'http', description: 'Bearer token', name: 'Authorization', in: 'header', scheme: 'bearer', bearerFormat: 'JWT' },
      ClientId: { type: 'apiKey', description: '客户端ID', name: 'clientid', in: 'header' }
    }
  }
}));

const generate = () => generateSkill({
  serviceId: 'uav-hub', skillName: 'uav-hub-api', documents: new Map([['uav', document()]])
});

test('retains all tags and first-tag grouping in the direct index without group files', () => {
  const files = generate();
  const index = files.get('references/index.md');
  for (const tag of ['航线任务', '设备管理', '航线图形合规校验', 'Terra重建管理', '工单管理', 'untagged'])
    assert.ok(index.includes(tag));
  assert.ok(![...files.keys()].some(path => path.includes('/groups/') || path.endsWith('context.md')));
  const lines = index.split('\n').filter(line => line.startsWith('- ['));
  assert.equal(lines.length, 9);
  for (const line of lines) assert.match(line, /service=uav-hub.*document=uav/);
});

test('effective server and security facts stay with the operation contract', () => {
  const operation = generate().get('references/operations/uav-hub--uav--post-drone-task-page.md');
  for (const fact of ['192.168.1.52:8071', 'Authorization', 'ClientId', 'bearer']) assert.ok(operation.includes(fact));
});

test('keeps the complete semantic file name instead of truncating it', () => {
  const files = generate();
  assert.ok(files.has('references/operations/uav-hub--uav--delete-drone-terra-reconstruction-model-file-by-file-id.md'));
  assert.ok(files.has('references/operations/uav-hub--uav--post-drone-terra-reconstruction-quality-report-by-id.md'));
  assert.ok(files.has('references/operations/uav-hub--uav--get-drone-wayline-recommended-dock-by-wayline-uuid.md'));
});

test('names group files from their OpenAPI tag, including non-ASCII tags', () => {
  assert.equal(tagFiles(new Map([['a', '航线任务']])).get('a'), '航线任务.md');
  assert.equal(tagFiles(new Map([['a', 'AI 识别']])).get('a'), 'AI-识别.md');
  assert.equal(tagFiles(new Map([['a', 'Terra重建管理']])).get('a'), 'Terra重建管理.md');
  assert.equal(tagFiles(new Map([['a', '   ']])).get('a'), 'untagged.md');
  assert.equal(tagFiles(new Map([['a', 'a/b:c*d?e"f<g>h|i']])).get('a'), 'a-b-c-d-e-f-g-h-i.md');
  const reserved = tagFiles(new Map([['a', 'CON']]));
  assert.notEqual(reserved.get('a'), 'CON.md', 'a Windows reserved device name must not become a bare file name');
  const colliding = tagFiles(new Map([['a', 'A B'], ['b', 'a  b']]));
  assert.notEqual(colliding.get('a').toLowerCase(), colliding.get('b').toLowerCase());
  assert.equal(tagFiles(new Map([['a', '航线任务']])).get('a'), tagFiles(new Map([['x', '航线任务']])).get('x'));
});

test('records the group on every operation index row', () => {
  const files = generate();
  const rows = files.get('references/operations.jsonl').trim().split('\n').map((line) => JSON.parse(line));
  const preview = rows.find(({ path }) => path === '/drone/task/preview');
  assert.equal(preview.group, '航线任务');
  assert.equal(preview.groupFile, undefined);
  assert.deepEqual(preview.tags, ['航线任务', '工单管理']);
  assert.ok(files.has(`references/${preview.file}`));
  for (const row of rows) {
    assert.ok(files.has(`references/${row.file}`), `missing group file for ${row.path}`);
  }
});

test('emits a resolvable link for every group and operation reference', () => {
  const files = generate();
  for (const [path, content] of files) {
    if (!path.endsWith('.md')) continue;
    for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
      const base = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      const resolved = decodeURIComponent(new URL(match[1], `file:///${base}`).pathname.slice(1));
      assert.ok(files.has(resolved), `${path} -> ${resolved}`);
    }
  }
});

test('advances the generated layout version', () => {
  const files = generate();
  assert.equal(JSON.parse(files.get('references/source.json')).generatorVersion, 'openapi-skill-core/4');
});

test('publishes a flat tree retaining non-ASCII tags in its index', async () => {
  const output = await mkdtemp(join(tmpdir(), 'openapi-skill-cjk-'));
  try {
    const published = await publishSkill(output, 'uav-hub', 'uav-hub-api', generate());
    assert.equal(published, join(output, 'uav-hub-api'));
    await access(join(published, 'references/index.md'));
    await access(join(published, 'references/operations/uav-hub--uav--get-drone-device-list.md'));
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

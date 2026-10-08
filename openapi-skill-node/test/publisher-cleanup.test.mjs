import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { test } from 'node:test';
import { generateProjectSkill, publishSkill } from '../dist/index.js';

const files = generateProjectSkill({ services: [{ serviceId: 'demo', documents: new Map([
  ['public', new TextEncoder().encode('{"openapi":"3.1.0","paths":{}}')]
]) }] });
const publish = output => publishSkill(output, 'api-docs', 'api-docs', files);

async function outputFor(t) {
  const output = await fs.mkdtemp(join(tmpdir(), 'openapi-skill-cleanup-'));
  t.after(() => fs.rm(output, { recursive: true, force: true }));
  return output;
}

function failRename(t, restoreFails = false) {
  const original = fs.rename;
  t.mock.method(fs, 'rename', async (from, to) => {
    if (from.includes(`${sep}staging${sep}`)) throw new Error('injected publication failure');
    if (restoreFails && from.includes(`${sep}backups${sep}`)) throw new Error('injected recovery failure');
    return original(from, to);
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
}

test('initial and repeated publication leave only the Skill directory', async t => {
  const output = await outputFor(t);
  for (let i = 0; i < 3; i++) {
    await publish(output);
    assert.deepEqual(await fs.readdir(output), ['api-docs']);
  }
});

test('removes empty working directories left by previous versions', async t => {
  const output = await outputFor(t);
  await fs.mkdir(join(output, '.openapi-skill', 'staging'), { recursive: true });
  await fs.mkdir(join(output, '.openapi-skill', 'backups'), { recursive: true });
  await publish(output);
  assert.deepEqual(await fs.readdir(output), ['api-docs']);
});

test('rejecting an unowned output cleans temporary directories without touching user files', async t => {
  const output = await outputFor(t);
  await fs.mkdir(join(output, 'api-docs'));
  await fs.writeFile(join(output, 'api-docs', 'user.txt'), 'keep');
  await assert.rejects(publish(output), /OUTPUT/);
  assert.deepEqual(await fs.readdir(output), ['api-docs']);
  assert.equal(await fs.readFile(join(output, 'api-docs', 'user.txt'), 'utf8'), 'keep');
});

test('failed replacement restores the old Skill and removes empty working directories', async t => {
  const output = await outputFor(t);
  await publish(output);
  const before = await fs.readFile(join(output, 'api-docs', 'SKILL.md'), 'utf8');
  failRename(t);
  await assert.rejects(publish(output), /injected publication failure/);
  assert.equal(await fs.readFile(join(output, 'api-docs', 'SKILL.md'), 'utf8'), before);
  assert.deepEqual(await fs.readdir(output), ['api-docs']);
});

test('failed initial publication leaves no Skill or working directories', async t => {
  const output = await outputFor(t);
  failRename(t);
  await assert.rejects(publish(output), /injected publication failure/);
  assert.deepEqual(await fs.readdir(output), []);
});

test('concurrent publications of different Skills do not delete each other\'s working data', async t => {
  const output = await outputFor(t);
  const names = ['first-api', 'second-api', 'third-api'];
  for (let i = 0; i < 3; i++) await Promise.all(names.map(async skillName => {
    const tree = generateProjectSkill({ skillName, services: [{ serviceId: 'demo', documents: new Map([
      ['public', new TextEncoder().encode('{"openapi":"3.1.0","paths":{}}')]
    ]) }] });
    await publishSkill(output, skillName, skillName, tree);
    assert.equal(await fs.readFile(join(output, skillName, 'SKILL.md'), 'utf8'), tree.get('SKILL.md'));
  }));
  assert.deepEqual((await fs.readdir(output)).sort(), names);
});

test('failed rollback retains the backup and reports its exact path', async t => {
  const output = await outputFor(t);
  await publish(output);
  failRename(t, true);
  let failure;
  try { await publish(output); } catch (error) { failure = error; }
  const parent = join(output, '.openapi-skill', 'backups');
  const backups = await fs.readdir(parent);
  assert.equal(backups.length, 1);
  const backup = join(parent, backups[0]);
  assert.equal(await fs.readFile(join(backup, 'SKILL.md'), 'utf8'), files.get('SKILL.md'));
  assert.ok(failure?.message.includes(backup), failure?.message);
  await assert.rejects(fs.stat(join(output, '.openapi-skill', 'staging')), { code: 'ENOENT' });
});

test('cleanup preserves other attempts, recovery data and Java state', async t => {
  const output = await outputFor(t);
  const kept = ['staging/other-attempt/data', 'backups/recovery/data', 'status/demo.json', 'locks/demo.lock', 'user.txt'];
  for (const name of kept) {
    const path = join(output, '.openapi-skill', name);
    await fs.mkdir(join(path, '..'), { recursive: true });
    await fs.writeFile(path, name);
  }
  await publish(output);
  for (const name of kept) assert.equal(await fs.readFile(join(output, '.openapi-skill', name), 'utf8'), name);
  assert.deepEqual(await fs.readdir(join(output, '.openapi-skill', 'staging')), ['other-attempt']);
  assert.deepEqual(await fs.readdir(join(output, '.openapi-skill', 'backups')), ['recovery']);
});

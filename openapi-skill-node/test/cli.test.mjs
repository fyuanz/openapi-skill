import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const runCli = (cwd, args = []) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
const valid = '{"openapi":"3.1.0","paths":{}}';

async function project(document = valid) {
  const cwd = await mkdtemp(join(tmpdir(), 'openapi-skill-cli-'));
  await writeFile(join(cwd, 'api.json'), document);
  await writeFile(join(cwd, 'openapi-skill.config.json'), JSON.stringify({
    services: [{ serviceId: 'users', documents: [{ id: 'account', url: './api.json' }] }]
  }));
  return cwd;
}

test('CLI separates success and failure output with stable exit codes', async () => {
  const cwd = await project();
  const success = runCli(cwd);
  assert.equal(success.status, 0);
  assert.match(success.stdout, /^Generated 1 service\(s\)/);
  assert.equal(success.stderr, '');

  await writeFile(join(cwd, 'api.json'), '{\n "openapi":"3.1.0",\n "paths" false\n}');
  const failed = runCli(cwd);
  assert.equal(failed.status, 1);
  assert.equal(failed.stdout, '');
  assert.match(failed.stderr, /^ERROR users\/account \[PARSE\/INVALID_JSON\]:.*line 3, column 10\)\r?\n$/);
  assert.doesNotMatch(failed.stderr, /at file:|Caused by:/);
});

test('CLI accepts debug and config in either order and rejects bad arguments', async () => {
  const cwd = await project();
  const config = join(cwd, 'openapi-skill.config.json');
  for (const args of [['--debug', '--config', config], ['--config', config, '--debug']]) {
    assert.equal(runCli(cwd, args).status, 0);
  }
  for (const args of [['--unknown'], ['--config'], ['--debug', '--debug'], ['--config', config, '--config', config]]) {
    const result = runCli(cwd, args);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Usage: openapi-skill \[--config <path>\] \[--debug\]/);
  }
});

test('debug mode appends the stack and cause chain', async () => {
  const cwd = await project('{"openapi":"3.1.0","paths":{},"paths":{}}');
  const result = runCli(cwd, ['--debug']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^ERROR users\/account \[PARSE\/INVALID_JSON\]:/);
  assert.match(result.stderr, /Caused by: DiagnosticError:/);
  assert.match(result.stderr, /Caused by:/);
});

test('default diagnostics do not disclose URL secrets or document text and preserve output', async () => {
  const cwd = await project();
  assert.equal(runCli(cwd).status, 0);
  const before = await readFile(join(cwd, '.agents', 'skills', 'api-docs', 'SKILL.md'), 'utf8');
  await writeFile(join(cwd, 'api.json'), '{"openapi":"3.1.0","token":"TOP-SECRET","paths" false}');
  const parseFailure = runCli(cwd);
  assert.doesNotMatch(parseFailure.stderr, /TOP-SECRET/);
  assert.equal(await readFile(join(cwd, '.agents', 'skills', 'api-docs', 'SKILL.md'), 'utf8'), before);

  await writeFile(join(cwd, 'openapi-skill.config.json'), JSON.stringify({
    services: [{ serviceId: 'users', documents: [{ id: 'account', url: 'https://name:password@127.0.0.1:1/api.json?token=QUERY-SECRET#FRAGMENT' }] }]
  }));
  const remoteFailure = runCli(cwd);
  assert.equal(remoteFailure.status, 1);
  assert.doesNotMatch(remoteFailure.stderr, /password|QUERY-SECRET|FRAGMENT/);
});

test('CLI lists every successful output directory', async () => {
  const cwd = await project();
  const outputs = [join(cwd, '.codex', 'skills'), join(cwd, '.trae', 'skills')];
  await writeFile(join(cwd, 'openapi-skill.config.json'), JSON.stringify({
    output: outputs,
    services: [{ serviceId: 'users', documents: [{ id: 'account', url: './api.json' }] }]
  }));
  const result = runCli(cwd);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Generated 1 service\(s\) and 1 OpenAPI document\(s\) into 2 output\(s\) \([^\r\n]+ files each\):/);
  assert.match(result.stdout, new RegExp(escapeRegExp(join(outputs[0], 'api-docs'))));
  assert.match(result.stdout, new RegExp(escapeRegExp(join(outputs[1], 'api-docs'))));
  assert.equal(result.stderr, '');
});

test('CLI reports every target after partial publication without disclosing document content', async () => {
  const cwd = await project('{"openapi":"3.1.0","info":{"description":"TOP-SECRET"},"paths":{}}');
  const outputs = [join(cwd, 'first'), join(cwd, 'blocked'), join(cwd, 'last')];
  await writeFile(outputs[1], 'not a directory');
  await writeFile(join(cwd, 'openapi-skill.config.json'), JSON.stringify({
    output: outputs,
    services: [{ serviceId: 'users', documents: [{ id: 'account', url: './api.json' }] }]
  }));
  const result = runCli(cwd);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^ERROR \[PUBLISH\/MULTI_OUTPUT_FAILED\]: 1 of 3 output targets failed/m);
  assert.match(result.stderr, new RegExp(`^OK ${escapeRegExp(join(outputs[0], 'api-docs'))}$`, 'm'));
  assert.match(result.stderr, new RegExp(`^FAILED ${escapeRegExp(join(outputs[1], 'api-docs'))} \\[`, 'm'));
  assert.match(result.stderr, new RegExp(`^OK ${escapeRegExp(join(outputs[2], 'api-docs'))}$`, 'm'));
  assert.doesNotMatch(result.stderr, /TOP-SECRET/);
});

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

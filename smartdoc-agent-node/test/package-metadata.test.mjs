import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const readmeZh = await readFile(new URL("../README.md", import.meta.url), "utf8");
const readmeEn = await readFile(new URL("../README.en.md", import.meta.url), "utf8");

test("publishes under the unscoped smartdoc-agent name", () => {
  assert.equal(packageJson.name, "smartdoc-agent");
  assert.equal(packageJson.version, "1.5.0");
  assert.ok(packageJson.files.includes("README.md"));
  assert.ok(packageJson.files.includes("README.en.md"));
});

test("ships a Chinese default README with reciprocal English navigation", () => {
  assert.match(readmeZh, /^# smartdoc-agent/m);
  assert.match(readmeZh, /\*\*简体中文\*\* \| \[English\]\(README\.en\.md\)/);
  assert.match(readmeZh, /npm install --save-dev smartdoc-agent/);
  assert.match(readmeZh, /"services"/);
  assert.match(readmeZh, /api-docs/);
  assert.match(readmeZh, /keywords/);
  assert.match(readmeZh, /sourceType/);

  assert.match(readmeEn, /^# smartdoc-agent/m);
  assert.match(readmeEn, /\[简体中文\]\(README\.md\) \| \*\*English\*\*/);
  assert.match(readmeEn, /npm install --save-dev smartdoc-agent/);
  assert.match(readmeEn, /"services"/);
  assert.match(readmeEn, /api-docs/);
  assert.match(readmeEn, /keywords/);
  assert.match(readmeEn, /sourceType/);
});

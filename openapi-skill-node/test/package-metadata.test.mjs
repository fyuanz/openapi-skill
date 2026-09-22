import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const readmeZh = await readFile(new URL("../README.md", import.meta.url), "utf8");
const readmeEn = await readFile(new URL("../README.en.md", import.meta.url), "utf8");

test("publishes under the unscoped openapi-skill name", () => {
  assert.equal(packageJson.name, "openapi-skill");
  assert.equal(packageJson.version, "2.1.2");
  assert.equal(packageJson.bin["openapi-skill"], "dist/cli.js");
  assert.equal(packageJson.repository.url, "git+https://github.com/fyuanz/openapi-skill.git");
  assert.equal(packageJson.homepage, "https://github.com/fyuanz/openapi-skill#readme");
  assert.equal(packageJson.bugs.url, "https://github.com/fyuanz/openapi-skill/issues");
  assert.ok(packageJson.files.includes("README.md"));
  assert.ok(packageJson.files.includes("README.en.md"));
});

test("ships a Chinese default README with reciprocal English navigation", () => {
  assert.match(readmeZh, /^# openapi-skill/m);
  assert.match(readmeZh, /\*\*简体中文\*\* \| \[English\]\(README\.en\.md\)/);
  assert.match(readmeZh, /npm install --save-dev openapi-skill/);
  assert.match(readmeZh, /"services"/);
  assert.match(readmeZh, /api-docs/);
  assert.match(readmeZh, /keywords/);
  assert.match(readmeZh, /sourceType/);
  assert.match(readmeZh, /"output"\s*:\s*\[/);
  assert.match(readmeZh, /1 至 8/);
  assert.match(readmeZh, /每个输出目录.*独立原子/s);
  assert.match(readmeZh, /不会.*回滚/s);

  assert.match(readmeEn, /^# openapi-skill/m);
  assert.match(readmeEn, /\[简体中文\]\(README\.md\) \| \*\*English\*\*/);
  assert.match(readmeEn, /npm install --save-dev openapi-skill/);
  assert.match(readmeEn, /"services"/);
  assert.match(readmeEn, /api-docs/);
  assert.match(readmeEn, /keywords/);
  assert.match(readmeEn, /sourceType/);
  assert.match(readmeEn, /"output"\s*:\s*\[/);
  assert.match(readmeEn, /1 to 8/);
  assert.match(readmeEn, /Each output directory.*independently atomic/s);
  assert.match(readmeEn, /not rolled back/s);
});

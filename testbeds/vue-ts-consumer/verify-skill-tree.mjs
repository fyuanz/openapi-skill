// Verifies a generated project Skill tree: file count, one context per document,
// clean (suffix-free) contract names, link validity, LLM navigation hygiene,
// exact security semantics, and a reproducible whole-tree hash.
//
// The whole-tree hash is defined here so the value is comparable between runs:
//   sha256( join("\n", sort(files).map(f => f.relPath + "\0" + sha256(f.bytes))) )
// with relPath in POSIX form, relative to the Skill root.
//
// Usage: node testbeds/vue-ts-consumer/verify-skill-tree.mjs [skillRoot]
// Default root: testbeds/vue-ts-consumer/.agents/skills/api-docs
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, posix } from 'node:path';

const root = resolve(process.argv[2] ?? 'testbeds/vue-ts-consumer/.agents/skills/api-docs');

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

const files = walk(root)
  .map((abs) => ({ abs, rel: relative(root, abs).split('\\').join('/') }))
  .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

const manifest = files.map((f) => `${f.rel}\0${sha(readFileSync(f.abs))}`).join('\n');
const treeHash = sha(Buffer.from(manifest, 'utf8'));

const fail = [];
const observed = [];

// 1. File count and single root entrypoint
observed.push(`files=${files.length}`);
if (files.length !== 21) fail.push(`expected 21 files, found ${files.length}`);

if (!files.some((f) => f.rel === 'SKILL.md')) fail.push('no root SKILL.md');
const nestedSkill = files.filter((f) => f.rel.endsWith('SKILL.md') && f.rel !== 'SKILL.md');
if (nestedSkill.length) fail.push(`nested SKILL.md: ${nestedSkill.map((f) => f.rel).join(', ')}`);

// 2. Exactly one unsplit context.md per document
const contexts = files.filter((f) => f.rel.endsWith('/context.md'));
observed.push(`contexts=${contexts.length} -> ${contexts.map((f) => f.rel.replace('/context.md', '')).join(', ')}`);
if (contexts.length !== 2) fail.push(`expected 2 document contexts, found ${contexts.length}`);

// 3. No routine digest suffix on ordinary contract files
const digestSuffix = files.filter((f) => /--[0-9a-f]{6,}\.md$/.test(f.rel));
observed.push(`digest-suffixed-contracts=${digestSuffix.length}`);
if (digestSuffix.length) fail.push(`unexpected digest suffixes: ${digestSuffix.map((f) => f.rel).join(', ')}`);

// 4. Every relative Markdown link resolves inside the tree
const linkRe = /\]\((?!https?:|mailto:|#)([^)\s]+)\)/g;
let links = 0;
const broken = [];
for (const f of files.filter((f) => f.rel.endsWith('.md'))) {
  for (const m of readFileSync(f.abs, 'utf8').matchAll(linkRe)) {
    const target = m[1].split('#')[0];
    if (!target) continue;
    links += 1;
    const resolved = posix.normalize(posix.join(posix.dirname(f.rel), target));
    if (!files.some((g) => g.rel === resolved)) broken.push(`${f.rel} -> ${target}`);
  }
}
observed.push(`links=${links} broken=${broken.length}`);
if (broken.length) fail.push(`broken links:\n  ${broken.join('\n  ')}`);

// 5. Trusted navigation must not send an LLM to the JSONL indexes
const trusted = files.filter(
  (f) => f.rel === 'SKILL.md' || f.rel.endsWith('/catalog.md') || f.rel.endsWith('/context.md'),
);
const jsonlMentions = [];
for (const f of trusted) {
  const text = readFileSync(f.abs, 'utf8');
  for (const needle of ['operations.jsonl', 'schemas.jsonl']) {
    if (text.includes(needle)) jsonlMentions.push(`${f.rel}: ${needle}`);
  }
}
observed.push(`trusted-files=${trusted.length} jsonl-references=${jsonlMentions.length}`);
if (jsonlMentions.length) fail.push(`JSONL leaked into LLM navigation:\n  ${jsonlMentions.join('\n  ')}`);

// 6. Exact security semantics on every operation page
const operations = files.filter((f) => f.rel.includes('/operations/'));
const missingSemantics = operations.filter(
  (f) => !/unstated|not a claim|declared|override/i.test(readFileSync(f.abs, 'utf8')),
);
observed.push(`operations=${operations.length} without-security-semantics=${missingSemantics.length}`);
if (missingSemantics.length) fail.push(`operations missing security semantics: ${missingSemantics.map((f) => f.rel).join(', ')}`);

console.log(`root: ${root}`);
console.log('--- observed ---');
for (const line of observed) console.log(`  ${line}`);
console.log(`whole-tree-sha256 = ${treeHash}`);
console.log('tree:');
for (const f of files) console.log(`  ${f.rel} (${statSync(f.abs).size}B)`);
if (fail.length) {
  console.log('\n--- FAILED ---');
  for (const line of fail) console.log(`  ${line}`);
  process.exit(1);
}
console.log('\nRESULT: PASS');

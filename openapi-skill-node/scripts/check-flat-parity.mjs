// Run after Maven tests: compare the independently generated Java and Node fixture outputs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateProjectSkill } from '../dist/index.js';

const fixture = await readFile(new URL('../../openapi-skill-core/src/test/resources/catalog-discovery.json', import.meta.url));
const empty = Buffer.from('{"openapi":"3.1.0","paths":{}}');
const documents = new Map([['business', fixture], ['empty', empty]]);
const shared = generateProjectSkill({ services: ['files', 'other'].map(serviceId => ({ serviceId, documents })) });
const paths = Object.fromEntries(Array.from({ length: 124 }, (_, i) => [`/items/${i}`, {
  get: { summary: `动作${i}`, tags: [`分组${i % 19}`], responses: {} }
}]));
const large = generateProjectSkill({ services: [{ serviceId: 'files', documents: new Map([
  ['business', Buffer.from(JSON.stringify({ openapi: '3.1.0', paths }))]
]) }] });

for (const [name, files] of [['shared', shared], ['large', large]]) {
  const java = async path => readFile(new URL(`../../openapi-skill-core/target/catalog-discovery/${name}/${path}`, import.meta.url), 'utf8');
  assert.equal(files.get('references/index.md'), await java('references/index.md'), `${name}: direct discovery`);
  for (const index of ['operations', 'schemas']) {
    const rows = content => content.split('\n').filter(line => line.trim()).map(JSON.parse);
    assert.deepEqual(rows(files.get(`references/${index}.jsonl`)), rows(await java(`references/${index}.jsonl`)), `${name}: ${index} ownership/paths/closure`);
  }
  for (const [path, content] of files) {
    if (!/^references\/(operations|schemas|refs)\//.test(path)) continue;
    const other = await java(path);
    const contract = text => JSON.parse(text.match(/```json\n([\s\S]*?)\n```/)[1]);
    assert.deepEqual(contract(content), contract(other), `${name}: ${path} contract`);
    const links = text => [...text.replace(/```json\n[\s\S]*?\n```/g, '').matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]).sort();
    assert.deepEqual(links(content), links(other), `${name}: ${path} links`);
  }
  console.log(`${name}: Java/Node flat index, identities, paths, contracts and reference links match`);
}

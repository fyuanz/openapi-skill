// Run after mvn -B clean install and the Node build. Uses only sanitized, test-generated artifacts.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateProjectSkill } from '../openapi-skill-node/dist/index.js';

const fixture = await readFile(new URL('../openapi-skill-core/src/test/resources/catalog-discovery.json', import.meta.url));
const empty = Buffer.from('{"openapi":"3.1.0","paths":{}}');
const documents = new Map([['business', fixture], ['empty', empty]]);
const paths = Object.fromEntries(Array.from({length: 124}, (_, i) => [`/items/${i}`, {get: {summary: `动作${i}`, tags: [`分组${i % 19}`], responses: {}}}]));
const examples = {
  shared: generateProjectSkill({services: ['files', 'other'].map(serviceId => ({serviceId, documents}))}),
  large: generateProjectSkill({services: [{serviceId: 'files', documents: new Map([['business', Buffer.from(JSON.stringify({openapi: '3.1.0', paths}))]])}]})
};
// Compare discovery sections and ownership in sequence; metadata wording and contract JSON indentation are unrelated.
const discovery = text => text.split('\n').filter(line =>
  /^#{2,5} (Service |Document |Interface discovery|.*interface\(s\))/.test(line) ||
  /^- /.test(line) && !line.includes('](services/') ||
  line.startsWith('No operations are documented.')
).join('\n');
for (const [name, files] of Object.entries(examples)) {
  for (const [path, node] of files) {
    if (!path.endsWith('/catalog.md')) continue;
    const java = await readFile(new URL(`../openapi-skill-core/target/catalog-discovery/${name}/${path}`, import.meta.url), 'utf8');
    assert.equal(discovery(node), discovery(java), `${name}/${path}`);
    if (path !== 'references/catalog.md') {
      const section = text => text.slice(text.indexOf('<!-- openapi-skill:interface-discovery -->'));
      assert.equal(section(node), section(java), `${name}/${path}: shared replaceable discovery section`);
    }
    console.log(`${name}/${path}: equivalent discovery; Java ${Buffer.byteLength(java)} B, Node ${Buffer.byteLength(node)} B`);
  }
  for (const [path, content] of files) {
    if (!path.endsWith('.md')) continue;
    for (const [, link] of content.replace(/```[\s\S]*?```/g, '').matchAll(/\]\(([^)]+)\)/g)) {
      const target = decodeURIComponent(new URL(link, `file:///${path}`).pathname.slice(1));
      assert.ok(files.has(target), `${path} -> ${target}`);
    }
  }
}
console.log('Both implementations cover the same operations and groups; all Node navigation links resolve.');

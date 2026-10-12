import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { syntheticBenchmark, projectSnapshot, measureBenchmark } from './retrieval-benchmark.mjs';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--skill')) throw new Error('Usage: node scripts/benchmark-retrieval.mjs [--skill <existing-v4-skill>]');
let input;
if (!args.length) input = syntheticBenchmark();
else {
  const root = args[1], before = new Map();
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Snapshot must not contain symlinks');
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) before.set(relative(root, path).split(sep).join('/'), await readFile(path, 'utf8'));
    }
  }
  await walk(root);
  const rows = before.get('references/operations.jsonl').split('\n').filter(Boolean).map(JSON.parse);
  // Representative broad searches, each with a source-derived target. No endpoint names or descriptions are printed.
  const scenarios = ['用户', '上传', '航线', '登录'].map(query => {
    const target = rows.find(row => row.summary.includes(query));
    return target ? { query, target: target.id } : undefined;
  }).filter(Boolean);
  if (rows.length) scenarios.push({ query: `${rows[0].method} ${rows[0].path}`, target: rows[0].id });
  input = { before, after: projectSnapshot(before), scenarios };
}
console.log(JSON.stringify(measureBenchmark(input.before, input.after, input.scenarios), null, 2));

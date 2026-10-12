import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syntheticBenchmark, measureBenchmark } from '../scripts/retrieval-benchmark.mjs';

test('retrieval benchmark preserves targets and deterministically reduces tokens and bytes', () => {
  const { before, after, scenarios } = syntheticBenchmark();
  const first = measureBenchmark(before, after, scenarios);
  assert.deepEqual(first, measureBenchmark(before, after, scenarios));
  assert.ok(first.index.after.bytes < first.index.before.bytes * 0.75);
  assert.ok(first.index.after.tokens < first.index.before.tokens * 0.75);
  assert.ok(first.queries.every(query => query.optimized.targetHit && query.baseline.targetHit));
  assert.ok(first.queries.some(query => query.optimized.tokens < query.baseline.tokens));
  assert.equal(first.encoding, 'cl100k_base');
});

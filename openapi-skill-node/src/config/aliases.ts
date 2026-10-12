import { normalizeKeywords } from './keywords.js';

export type OperationAliases = Readonly<Record<string, readonly string[]>>;

export function normalizeAliases(value: unknown): Record<string, string[]> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('CONFIG: operationAliases must be an object');
  const entries = Object.entries(value);
  if (entries.length > 5000) throw new Error('CONFIG: too many operation aliases');
  const result: Record<string, string[]> = {};
  for (const [key, aliases] of entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (!/^(GET|PUT|POST|DELETE|OPTIONS|HEAD|PATCH|TRACE) \/\S*$/.test(key))
      throw new Error('CONFIG: operationAliases keys must use uppercase METHOD /path');
    result[key] = normalizeKeywords(aliases, 'operationAliases');
  }
  return result;
}

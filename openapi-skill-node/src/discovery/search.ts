import { asObject } from '../input/parse.js';

export interface SearchOptions { query: string; service?: string; document?: string; limit?: number; offset?: number }
export interface SearchHit {
  id: string; serviceId: string; documentId: string; method: string; path: string;
  summary: string; operationId: string | null; file: string;
  summaryTruncated?: true;
}
export interface SearchResult { total: number; offset: number; limit: number; hasMore: boolean; results: SearchHit[] }
type SearchRow = SearchHit & { tags: string[]; aliases: string[]; scope: string[] };
const METHODS = new Set(['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH', 'TRACE']);
const norm = (text: string): string => text.normalize('NFC').toLowerCase();
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

export function validateSearchOptions(options: SearchOptions): void {
  if (typeof options.query !== 'string' || !options.query.trim() || options.query.length > 512 || /[\u0000-\u001f\u007f]/u.test(options.query))
    throw new Error('CONFIG: search query must contain 1 to 512 printable characters');
  if (!Number.isSafeInteger(options.limit ?? 10) || (options.limit ?? 10) < 1 || (options.limit ?? 10) > 100)
    throw new Error('CONFIG: search limit must be an integer from 1 to 100');
  if (!Number.isSafeInteger(options.offset ?? 0) || (options.offset ?? 0) < 0)
    throw new Error('CONFIG: search offset must be a non-negative safe integer');
  for (const field of [options.service, options.document]) if (field !== undefined && (typeof field !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(field)))
    throw new Error('CONFIG: search service/document must be a valid identity');
}

/** Searches metadata only. It does not open contracts, invoke APIs, or hide later pages. */
export function searchSkill(files: ReadonlyMap<string, string>, options: SearchOptions): SearchResult {
  validateSearchOptions(options);
  const rows = readSearchRows(files).filter(row => (!options.service || row.serviceId === options.service)
    && (!options.document || row.documentId === options.document));
  const query = options.query.trim(), route = /^(GET|PUT|POST|DELETE|OPTIONS|HEAD|PATCH|TRACE)\s+(\/\S*)$/i.exec(query);
  const exactIds = rows.filter(row => row.operationId === query);
  let ranked: { row: SearchRow; score: number }[];
  if (route) ranked = rows.filter(row => row.method === route[1]!.toUpperCase() && row.path === route[2]).map(row => ({ row, score: 100 }));
  else if (exactIds.length) ranked = exactIds.map(row => ({ row, score: 100 }));
  else {
    const terms = [...new Set(norm(query).split(/\s+/u))];
    ranked = rows.map(row => ({ row, score: score(row, terms) })).filter(item => item.score > 0);
  }
  ranked.sort((a, b) => b.score - a.score || compare(a.row.id, b.row.id));
  const offset = options.offset ?? 0, limit = options.limit ?? 10;
  return { total: ranked.length, offset, limit, hasMore: offset + limit < ranked.length,
    results: ranked.slice(offset, offset + limit).map(({ row }) => ({ id: row.id, serviceId: row.serviceId,
      documentId: row.documentId, method: row.method, path: row.path, ...previewSummary(row.summary),
      operationId: row.operationId, file: `references/${row.file}` })) };
}

function previewSummary(summary: string): Pick<SearchHit, 'summary' | 'summaryTruncated'> {
  const characters = [...summary];
  return characters.length <= 160 ? { summary }
    : { summary: characters.slice(0, 159).join('') + '…', summaryTruncated: true };
}

function score(row: SearchRow, terms: string[]): number {
  const fields: [string, number][] = [[row.summary, 8], [row.aliases.join(' '), 8], [row.path, 6],
    [row.operationId ?? '', 6], [row.tags.join(' '), 4], [row.scope.join(' '), 1]];
  const weights = terms.map(term => Math.max(0, ...fields.map(([text, weight]) => norm(text).includes(term) ? weight : 0)));
  return weights.every(weight => weight > 0) ? weights.reduce((a, b) => a + b, 0) : 0;
}

function strings(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new Error('OUTPUT: invalid search terms');
  return value as string[];
}

function parse(text: string | undefined): unknown {
  if (text === undefined || Buffer.byteLength(text) > 64 * 1024 * 1024) throw new Error('OUTPUT: search metadata missing or oversized');
  try { return JSON.parse(text); } catch { throw new Error('OUTPUT: invalid search metadata JSON'); }
}

function readSearchRows(files: ReadonlyMap<string, string>): SearchRow[] {
  const source = asObject(parse(files.get('references/source.json')));
  if (!source || source.generatorVersion !== 'openapi-skill-core/4') throw new Error('OUTPUT: search requires v4 source metadata');
  if (source.kind !== undefined && source.kind !== 'project') throw new Error('OUTPUT: invalid search source kind');
  const members = source.kind ? source.services : [source];
  if (!Array.isArray(members) || !members.length || members.length > 32) throw new Error('OUTPUT: invalid search services');
  const scopes = new Map<string, { terms: string[]; count: number }>();
  const services = new Set<string>();
  const identity = (value: unknown): value is string => typeof value === 'string' && value.length <= 63 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  for (const raw of members) {
    const member = asObject(raw);
    if (!member || !identity(member.serviceId) || services.has(member.serviceId)
      || !Array.isArray(member.documents) || !member.documents.length || member.documents.length > 32) throw new Error('OUTPUT: invalid search service');
    services.add(member.serviceId);
    for (const rawDocument of member.documents) {
      const doc = asObject(rawDocument);
      if (!doc || !identity(doc.documentId) || !Number.isSafeInteger(doc.operations) || Number(doc.operations) < 0)
        throw new Error('OUTPUT: invalid search document');
      const owner = `${member.serviceId}/${doc.documentId}`;
      if (scopes.has(owner)) throw new Error('OUTPUT: duplicate search document');
      scopes.set(owner, { terms: [...strings(source.keywords), ...strings(member.keywords), ...strings(doc.keywords),
        member.serviceId, doc.documentId], count: Number(doc.operations) });
    }
  }
  const content = files.get('references/operations.jsonl');
  if (content === undefined || Buffer.byteLength(content) > 64 * 1024 * 1024) throw new Error('OUTPUT: operation search index missing or oversized');
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length > 10_000) throw new Error('OUTPUT: operation search index too large');
  const ids = new Set<string>(), targets = new Set<string>(), counts = new Map<string, number>();
  const rows = lines.map(line => {
    const row = asObject(parse(line));
    if (!row || !['id', 'serviceId', 'documentId', 'method', 'path', 'summary', 'file'].every(field => typeof row[field] === 'string'))
      throw new Error('OUTPUT: invalid search operation row');
    if (!METHODS.has(String(row.method)) || !String(row.path).startsWith('/')
      || row.id !== `operation:${row.serviceId}:${row.documentId}:${String(row.method).toLowerCase()}:${row.path}`)
      throw new Error('OUTPUT: invalid search operation identity');
    if (ids.has(String(row.id)) || targets.has(String(row.file)) || !/^operations\/[a-z0-9._-]{1,120}\.md$/.test(String(row.file)))
      throw new Error('OUTPUT: duplicate or unsafe search operation');
    if (row.sourceOperationId !== null && row.sourceOperationId !== undefined && typeof row.sourceOperationId !== 'string')
      throw new Error('OUTPUT: invalid source operationId');
    const owner = `${row.serviceId}/${row.documentId}`, scope = scopes.get(owner);
    if (!scope) throw new Error('OUTPUT: unknown search operation owner');
    ids.add(String(row.id)); targets.add(String(row.file)); counts.set(owner, (counts.get(owner) ?? 0) + 1);
    return { id: String(row.id), serviceId: String(row.serviceId), documentId: String(row.documentId), method: String(row.method),
      path: String(row.path), summary: String(row.summary), file: String(row.file), operationId: row.sourceOperationId as string | null ?? null,
      tags: strings(row.tags), aliases: strings(row.aliases), scope: scope.terms };
  });
  for (const [owner, scope] of scopes) if ((counts.get(owner) ?? 0) !== scope.count) throw new Error('OUTPUT: search operation count mismatch');
  return rows;
}

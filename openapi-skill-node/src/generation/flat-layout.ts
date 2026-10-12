import { renderIndex } from '../discovery/render-index.js';
import { renderEntrypoint } from '../discovery/entrypoint.js';
import { qualityFindings, QualityFinding } from '../diagnostics/quality.js';
import { posix } from 'node:path';
import { JsonObject } from '../input/parse.js';
import { digest, sorted } from './references.js';

export const FLAT_VERSION = 'openapi-skill-core/4';
const encoder = new TextEncoder();
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const values = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

/** Project a complete service/project contract tree into the shared flat output format. */
export function flattenSkill(input: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  const source = JSON.parse(input.get('references/source.json')!) as JsonObject;
  const members = source.kind ? values(source.services) as JsonObject[] : [source];
  const output = new Map<string, string>();
  const operations: JsonObject[] = [], schemas: JsonObject[] = [];
  const documents: JsonObject[] = [];
  const findings: QualityFinding[] = [];
  for (const member of members) {
    const prefix = source.kind ? `references/services/${member.serviceId}/` : '';
    const files = new Map([...input].filter(([path]) => path.startsWith(prefix)).map(([path, content]) => [path.slice(prefix.length), content]));
    const paths = new Map<string, string>([['references/conventions.md', 'references/conventions.md']]);
    for (const [path] of files) {
      const old = /^references\/documents\/([^/]+)\/(operations|schemas|refs)\/([^/]+)\.md$/.exec(path);
      if (old) {
        const stem = `${member.serviceId}--${old[1]}--${old[3]}`;
        const filename = stem.length <= 117 ? `${stem}.md`
          : `${stem.slice(0, 98)}--${digest(encoder.encode(`${member.serviceId}/${path}`)).slice(0, 16)}.md`;
        paths.set(path, `references/${old[2]}/${filename}`);
      } else if (/^references\/(operations|schemas|refs)\/[^/]+\.md$/.test(path)) paths.set(path, path);
    }
    for (const [before, after] of paths) {
      const content = files.get(before);
      if (content === undefined) throw new Error(`OUTPUT: missing contract ${before}`);
      const rendered = rewriteLinks(content, before, after, paths);
      if (output.has(after) && (after !== 'references/conventions.md' || output.get(after) !== rendered))
        throw new Error(`OUTPUT: flat path collision at ${after}`);
      output.set(after, rendered);
    }
    const mapped = (file: unknown): string => {
      const path = paths.get(`references/${file}`);
      if (!path) throw new Error(`OUTPUT: missing flat target ${file}`);
      return path.slice('references/'.length);
    };
    for (const row of readRows(files, 'operations')) {
      row.file = mapped(row.file);
      row.closureFiles = values(row.closureFiles).map(mapped).sort(compare);
      for (const field of ['requestFiles', 'responseFiles']) if (row[field]) row[field] = values(row[field]).map(mapped).sort(compare);
      const page = output.get(`references/${row.file}`)!;
      const contract = JSON.parse(page.match(/```json\n([\s\S]*?)\n```/)![1]!) as JsonObject;
      findings.push(...qualityFindings(contract));
      row.recursiveEdges ??= [];
      delete row.groupFile;
      operations.push(row);
    }
    for (const row of readRows(files, 'schemas')) { row.file = mapped(row.file); schemas.push(row); }
    for (const doc of values(member.documents) as JsonObject[]) documents.push({
      ...doc, serviceId: member.serviceId,
      keywords: values(doc.keywords)
    });
    member.generatorVersion = FLAT_VERSION;
  }
  source.generatorVersion = FLAT_VERSION;
  source.discoveryFormat = 'scoped-v1';
  source.quality = { findings: findings.sort((a, b) => compare(`${a.serviceId}/${a.documentId}/${a.method}/${a.path}/${a.code}`, `${b.serviceId}/${b.documentId}/${b.method}/${b.path}/${b.code}`)) };
  output.set('references/source.json', JSON.stringify(source, null, 2));
  output.set('references/operations.jsonl', jsonLines(operations));
  output.set('references/schemas.jsonl', jsonLines(schemas));
  output.set('references/index.md', renderIndex(source, documents, operations));
  output.set('SKILL.md', renderEntrypoint(source));
  if (output.size > 10_000 || [...output.values()].reduce((sum, content) => sum + encoder.encode(content).length, 0) > 64 * 1024 * 1024)
    throw new Error('LIMIT: flat output exceeded');
  return new Map(sorted(output));
}

function readRows(files: ReadonlyMap<string, string>, name: string): JsonObject[] {
  return (files.get(`references/${name}.jsonl`) ?? '').split('\n').filter(line => line.trim()).map(line => JSON.parse(line) as JsonObject);
}

function jsonLines(rows: JsonObject[]): string {
  return rows.sort((a, b) => compare(String(a.id), String(b.id))).map(row => JSON.stringify(row) + '\n').join('');
}

/** Only generated links outside fenced source data are rewritten. */
function rewriteLinks(content: string, before: string, after: string, paths: Map<string, string>): string {
  let fenced = false;
  return content.split('\n').map(line => {
    if (line.trimStart().startsWith('```')) { fenced = !fenced; return line; }
    if (fenced) return line;
    return line.replace(/\]\(([^)]+)\)/g, (_, link: string) => {
      const resolved = posix.normalize(posix.join(posix.dirname(before), link));
      const target = paths.get(resolved);
      if (!target) throw new Error(`OUTPUT: unmapped reference ${before} -> ${link}`);
      return `](${posix.relative(posix.dirname(after), target)})`;
    });
  }).join('\n');
}

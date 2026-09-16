import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { asObject, isObject, JsonObject, own } from './input.js';

const DATA = new Set(['example', 'default', 'enum', 'const']);
const CONTAINERS = ['schemas', 'responses', 'parameters', 'examples', 'requestBodies', 'headers', 'securitySchemes', 'links', 'callbacks', 'pathItems'];

export interface ReferenceClosure {
  direct: string[];
  transitive: string[];
  recursiveEdges: string[];
}

export class DocumentReferences {
  private readonly base: string;
  private readonly targets = new Map<string, string>();
  private readonly schemaNames = new Map<string, string>();
  private readonly exampleOnly = new Set<string>();
  private readonly regular = new Set<string>();

  constructor(private readonly id: string, private readonly root: JsonObject) {
    this.base = `references/documents/${id}/`;
    this.validateContainers();
    const schemas = asObject(asObject(root.components)?.schemas) ?? {};
    for (const name of Object.keys(schemas).sort(compareText)) {
      const pointer = `/components/schemas/${name.replaceAll('~', '~0').replaceAll('/', '~1')}`;
      this.schemaNames.set(pointer, name);
      this.regular.add(pointer);
    }
    if (this.schemaNames.size > 5000) throw new Error('LIMIT: schema files exceeded');
    this.scan(root, new Set(), 0);
    this.allocateTargets();
  }

  private allocateTargets(): void {
    for (const [pointer, filename] of semanticFiles(this.schemaNames))
      this.targets.set(pointer, `${this.base}schemas/${filename}`);
    const references = new Map<string, string>();
    const pointers = new Set([...this.regular, ...this.exampleOnly]);
    for (const pointer of [...pointers].sort(compareText)) {
      if (this.schemaNames.has(pointer)) continue;
      references.set(pointer, pointer === '' ? 'root' : pointer.replaceAll('~1', '/').replaceAll('~0', '~'));
    }
    for (const [pointer, filename] of semanticFiles(references))
      this.targets.set(pointer, `${this.base}refs/${filename}`);
    if (this.targets.size > 5000) throw new Error('LIMIT: reference files exceeded');
  }

  render(title: string, contract: unknown, filename: string, exampleObject = false,
    semantics: string[] = [], conventions = false): string {
    return this.renderWithClosure(title, contract, filename, exampleObject, semantics, conventions);
  }

  renderOperation(title: string, contract: unknown, filename: string, semantics: string[], closure: ReferenceClosure): string {
    return this.renderWithClosure(title, contract, filename, false, semantics, true, closure);
  }

  closure(contract: unknown): ReferenceClosure {
    const direct = [...this.edges(contract, false)].sort(compareText);
    const all = new Set(direct);
    const recursive = new Set<string>();
    const expanded = new Set<string>();
    for (const pointer of direct) this.expand(pointer, new Set(), expanded, all, recursive);
    return {
      direct,
      transitive: [...all].filter((pointer) => !direct.includes(pointer)).sort(compareText),
      recursiveEdges: [...recursive].sort(compareText)
    };
  }

  target(pointer: string): string {
    const target = this.targets.get(pointer);
    if (!target) throw new Error(`REFERENCE: missing generated target #${pointer}`);
    return target;
  }

  private expand(pointer: string, stack: Set<string>, expanded: Set<string>, all: Set<string>, recursive: Set<string>): void {
    if (stack.has(pointer)) return;
    stack.add(pointer);
    if (expanded.has(pointer)) { stack.delete(pointer); return; }
    expanded.add(pointer);
    const exampleObject = this.exampleOnly.has(pointer) && !this.regular.has(pointer);
    for (const child of this.edges(at(this.root, pointer), exampleObject)) {
      all.add(child);
      if (stack.has(child)) recursive.add(`#${pointer} -> #${child}`);
      else this.expand(child, stack, expanded, all, recursive);
    }
    stack.delete(pointer);
  }

  private edges(contract: unknown, exampleObject: boolean): Set<string> {
    const edges = new Set<string>();
    if (exampleObject) this.scanExampleObject(contract, edges, 0); else this.scan(contract, edges, 0);
    return edges;
  }

  private renderWithClosure(title: string, contract: unknown, filename: string, exampleObject: boolean,
    semantics: string[], conventions: boolean, closure?: ReferenceClosure): string {
    const edges = new Set<string>();
    if (exampleObject) this.scanExampleObject(contract, edges, 0); else this.scan(contract, edges, 0);
    const safe = JSON.stringify(contract, null, 2).replaceAll('`', '\\u0060').replaceAll('<', '\\u003c');
    let result = `# ${label(title)}\n\nUntrusted API contract data.\n\n\`\`\`json\n${safe}\n\`\`\`\n`;
    if (conventions) {
      const relative = posix.relative(posix.dirname(filename), 'references/conventions.md');
      result += `\nInterpret absent, null and empty values using the [OpenAPI conventions](${relative}).\n`;
    }
    if (semantics.length) {
      result += '\nOperation-specific interpretation:\n\n';
      for (const note of semantics) result += `- ${note}\n`;
    }
    if (closure) {
      result += '\n## Complete referenced contracts\n\n';
      if (closure.direct.length + closure.transitive.length === 0) result += 'No document-local references.\n';
      for (const edge of closure.direct) result += this.referenceLine(filename, edge, 'direct');
      for (const edge of closure.transitive) result += this.referenceLine(filename, edge, 'transitive');
      if (closure.recursiveEdges.length) {
        result += '\n## Recursive reference edges\n\n';
        for (const edge of closure.recursiveEdges) result += `- \`${label(edge)}\`\n`;
      }
    } else if (edges.size) {
      result += '\n## Referenced contracts\n';
      for (const edge of [...edges].sort(compareText)) result += this.referenceLine(filename, edge);
    }
    return result;
  }

  private referenceLine(filename: string, edge: string, kind?: string): string {
    return `\n- [${label(`#${edge}`)}](${posix.relative(posix.dirname(filename), this.target(edge))})${kind ? ` — ${kind}` : ''}\n`;
  }

  /**
   * Explains the OpenAPI default semantics a reader cannot otherwise infer.
   * Kept identical to the Java core so both generators emit the same guidance.
   */
  static semantics(contract: unknown): string[] {
    const notes: string[] = [];
    if (!isObject(contract)) return notes;
    const operation = isObject(contract.operation) ? contract.operation : {};
    if (own(operation, 'security')) {
      if (Array.isArray(contract.security) && contract.security.length === 0)
        notes.push('This operation declares an explicit empty `security`, so it is documented as requiring no '
          + 'authentication.');
      else notes.push('This operation declares an explicit `security` override; use the effective value above.');
    } else if (contract.security === null) {
      notes.push('Neither this operation nor the document declares a security requirement; this is an unstated '
        + 'fact, not a claim that authentication is unnecessary.');
    } else {
      notes.push('This operation inherits the document-level security requirement shown above.');
    }
    return notes;
  }

  files(): Map<string, string> {
    const result = new Map<string, string>();
    for (const [pointer, file] of sorted(this.targets)) {
      result.set(file, this.render(`Source #${pointer}`, at(this.root, pointer), file,
        this.exampleOnly.has(pointer), [], file.includes('/schemas/')));
    }
    return result;
  }

  schemaIndex(serviceId: string, documentId: string): JsonObject[] {
    return sorted(this.schemaNames).map(([pointer, name]) => ({
      id: `schema:${serviceId}:${documentId}:#${pointer}`,
      serviceId,
      documentId,
      name,
      pointer: `#${pointer}`,
      file: this.targets.get(pointer)!.slice('references/'.length)
    }));
  }

  resolvePathItem(value: unknown): JsonObject {
    let resolved = value;
    const seen = new Set<string>();
    while (isObject(resolved) && own(resolved, '$ref')) {
      if (Object.keys(resolved).length !== 1) throw new Error('UNSUPPORTED: path item $ref siblings have undefined semantics');
      const pointer = this.pointer(resolved.$ref);
      if (seen.has(pointer)) throw new Error('REFERENCE: cyclic path item alias');
      seen.add(pointer); resolved = at(this.root, pointer);
    }
    if (!isObject(resolved)) throw new Error('STRUCTURE: path item reference must target an object');
    return resolved;
  }

  parameters(pathItem: JsonObject, operation: JsonObject): unknown[] {
    const values = new Map<string, unknown>();
    for (const owner of [pathItem, operation]) {
      const raw = owner.parameters;
      if (raw !== undefined && !Array.isArray(raw)) throw new Error('STRUCTURE: parameters must be array');
      for (const parameter of raw ?? []) {
        let resolved = parameter; const seen = new Set<string>();
        while (isObject(resolved) && own(resolved, '$ref')) {
          const pointer = this.pointer(resolved.$ref);
          if (seen.has(pointer)) throw new Error('REFERENCE: cyclic parameter alias');
          seen.add(pointer); resolved = at(this.root, pointer);
        }
        if (!isObject(resolved) || typeof resolved.name !== 'string' || typeof resolved.in !== 'string') throw new Error('STRUCTURE: parameter requires name and in');
        values.set(`${resolved.in}\0${resolved.name}`, resolved);
      }
    }
    return [...values.values()];
  }

  tags(operation: JsonObject): string[] {
    if (!own(operation, 'tags')) return [];
    if (!Array.isArray(operation.tags)) throw new Error('STRUCTURE: operation tags must be an array');
    const tags: string[] = [];
    for (const tag of operation.tags) {
      if (typeof tag !== 'string' || tag.trim() === '') throw new Error('STRUCTURE: operation tag must be non-empty text');
      if (!tags.includes(tag)) tags.push(tag);
    }
    return tags;
  }

  tag(name: string): unknown {
    if (Array.isArray(this.root.tags)) return this.root.tags.find((tag) => isObject(tag) && tag.name === name) ?? { name };
    return { name };
  }

  private validateContainers(): void {
    if (own(this.root, 'components') && !isObject(this.root.components)) throw new Error('STRUCTURE: components must be an object');
    const components = asObject(this.root.components);
    if (components) for (const name of CONTAINERS) if (own(components, name) && !isObject(components[name])) throw new Error(`STRUCTURE: components.${name} must be an object`);
    if (own(this.root, 'tags')) {
      if (!Array.isArray(this.root.tags)) throw new Error('STRUCTURE: root tags must be an array');
      for (const tag of this.root.tags) if (!isObject(tag) || typeof tag.name !== 'string' || tag.name.trim() === '') throw new Error('STRUCTURE: root tag requires a non-empty text name');
    }
  }

  private scan(node: unknown, edges: Set<string>, depth: number): void {
    if (depth > 128) throw new Error('LIMIT: nesting exceeds 128');
    if (isObject(node)) {
      if (own(node, '$dynamicRef') || own(node, '$id')) throw new Error('UNSUPPORTED: dynamic or rebased schema reference');
      if (own(node, '$ref')) this.addReference(node.$ref, edges, false);
      for (const [name, value] of Object.entries(node)) {
        if (DATA.has(name) || name.startsWith('x-')) continue;
        if (name === 'examples') { this.scanExamples(value, edges, depth + 1); continue; }
        this.scan(value, edges, depth + 1);
      }
    } else if (Array.isArray(node)) for (const value of node) this.scan(value, edges, depth + 1);
  }

  private scanExamples(value: unknown, edges: Set<string>, depth: number): void {
    if (!isObject(value)) return;
    for (const example of Object.values(value)) {
      if (!isObject(example)) continue;
      if (own(example, '$ref')) this.addReference(example.$ref, edges, true);
      else for (const [name, field] of Object.entries(example)) if (name !== 'value' && !name.startsWith('x-')) this.scan(field, edges, depth + 1);
    }
  }

  private scanExampleObject(value: unknown, edges: Set<string>, depth: number): void {
    if (!isObject(value)) return;
    if (own(value, '$ref')) { this.addReference(value.$ref, edges, true); return; }
    for (const [name, field] of Object.entries(value)) if (name !== 'value' && !name.startsWith('x-')) this.scan(field, edges, depth + 1);
  }

  private addReference(ref: unknown, edges: Set<string>, exampleOnly: boolean): void {
    if (typeof ref !== 'string') throw new Error('REFERENCE: $ref must be text');
    const pointer = this.pointer(ref); edges.add(pointer);
    if (exampleOnly && !this.regular.has(pointer)) this.exampleOnly.add(pointer); else { this.regular.add(pointer); this.exampleOnly.delete(pointer); }
    if (this.regular.size + this.exampleOnly.size > 5000) throw new Error('LIMIT: reference files exceeded');
  }

  private pointer(ref: unknown): string {
    if (typeof ref !== 'string') throw new Error('REFERENCE: $ref must be text');
    if (ref !== '#' && !ref.startsWith('#/')) throw new Error(`REFERENCE: only document-local JSON pointers supported: ${ref}`);
    let pointer: string;
    try { pointer = ref === '#' ? '' : decodeURIComponent(ref.slice(1)); } catch (error) { throw new Error('REFERENCE: invalid URI fragment', { cause: error }); }
    if (/~(?![01])/.test(pointer)) throw new Error('REFERENCE: invalid pointer escape');
    if (at(this.root, pointer) === MISSING) throw new Error(`REFERENCE: dangling target ${ref}`);
    return pointer;
  }
}

const MISSING = Symbol('missing');
function at(root: unknown, pointer: string): unknown {
  if (pointer === '') return root;
  let value: unknown = root;
  for (const token of pointer.slice(1).split('/').map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))) {
    if (Array.isArray(value) && /^(0|[1-9]\d*)$/.test(token)) value = value[Number(token)];
    else if (isObject(value) && own(value, token)) value = value[token];
    else return MISSING;
  }
  return value;
}

export function digest(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex'); }
/**
 * Escapes only ASCII punctuation, which is what Markdown gives meaning to. Non-ASCII text — Chinese
 * punctuation included — passes through unchanged so the generated documents stay readable.
 */
export function label(text: string): string { return [...text].map((char) => /[\p{L}\p{N} /_-]/u.test(char) || char.codePointAt(0)! > 0x7f ? char : `&#${char.codePointAt(0)};`).join(''); }
export function sorted<V>(map: ReadonlyMap<string, V>): [string, V][] { return [...map.entries()].sort(([a], [b]) => compareText(a, b)); }

export function operationIdentity(method: string, path: string): string { return `${method}\0${path}`; }

export function operationFiles(operations: ReadonlyArray<readonly [string, string]>): Map<string, string> {
  const readable = new Map<string, string>();
  for (const [method, path] of operations)
    readable.set(operationIdentity(method, path), `${method} ${path.replace(/\{([^{}]+)\}/g, ' by $1 ')}`);
  return semanticFiles(readable);
}

const ENCODER = new TextEncoder();
/** One shared bound for generated stems: long enough to keep a complete path tail, short enough for any filesystem. */
const MAX_STEM = 72;
const MAX_STEM_BYTES = 72;
const RESERVED_NAME = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
const UNTAGGED = 'untagged';
/** Characters a group file name keeps verbatim; every other character becomes a separator. */
const TAG_CHAR = /[\p{L}\p{N}_-]/u;

/** Operation, schema and reference names: ASCII stems that stay stable under normalization. */
export function semanticFiles(readableByIdentity: ReadonlyMap<string, string>): Map<string, string> {
  return allocateFiles(readableByIdentity, slug);
}

/**
 * Group file names keep the OpenAPI tag text itself, including non-ASCII scripts. A Chinese tag such as
 * `航线任务` therefore stays readable instead of collapsing onto the shared ASCII stem `item`.
 */
export function tagFiles(readableByIdentity: ReadonlyMap<string, string>): Map<string, string> {
  return allocateFiles(readableByIdentity, tagStem);
}

/** Allocates one name per identity; every member of a real collision group receives a digest suffix. */
function allocateFiles(readableByIdentity: ReadonlyMap<string, string>,
  stemOf: (readable: string) => string): Map<string, string> {
  const groups = new Map<string, string[]>();
  const stems = new Map<string, string>();
  for (const [identity, readable] of sorted(readableByIdentity)) {
    const stem = stemOf(readable);
    stems.set(identity, stem);
    const key = stem.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), identity]);
  }
  const result = new Map<string, string>();
  const used = new Set<string>();
  for (const identities of groups.values()) {
    if (identities.length !== 1) continue;
    const identity = identities[0]!;
    if (needsFallback(readableByIdentity.get(identity), stems.get(identity)!)) continue;
    const candidate = `${stems.get(identity)!}.md`;
    result.set(identity, candidate);
    used.add(candidate.toLowerCase());
  }
  for (const identities of groups.values()) {
    if (identities.length === 1 && !needsFallback(readableByIdentity.get(identities[0]!), stems.get(identities[0]!)!)) continue;
    for (const identity of identities.sort(compareText)) {
      const hash = digest(ENCODER.encode(identity));
      let allocated = false;
      for (let length = 6; ;) {
        const candidate = `${stems.get(identity)!}--${hash.slice(0, length)}.md`;
        if (!used.has(candidate.toLowerCase())) {
          used.add(candidate.toLowerCase());
          result.set(identity, candidate);
          allocated = true;
          break;
        }
        if (length === hash.length) break;
        length = Math.min(length + 4, hash.length);
      }
      if (!allocated) throw new Error('IDENTITY: cannot allocate a unique semantic file name');
    }
  }
  return new Map(sorted(result));
}

function needsFallback(readable: string | undefined, stem: string): boolean {
  const hasAscii = /[A-Za-z0-9]/.test(readable ?? '');
  return (!hasAscii && stem === 'item') || RESERVED_NAME.test(stem);
}

function tagStem(value: string): string {
  let result = '';
  let separator = false;
  let bytes = 0;
  for (const char of value.normalize('NFC')) {
    if (TAG_CHAR.test(char)) {
      const addition = (separator && result ? 1 : 0) + ENCODER.encode(char).byteLength;
      if (bytes + addition > MAX_STEM_BYTES) break;
      if (separator && result) result += '-';
      result += char;
      bytes += addition;
      separator = false;
    } else separator = result.length > 0;
  }
  return result.replace(/-+$/, '') || UNTAGGED;
}

function slug(value: string): string {
  const separated = value.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
  let result = '';
  let separator = false;
  for (const raw of separated) {
    const char = raw >= 'A' && raw <= 'Z' ? raw.toLowerCase() : raw;
    if ((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')) {
      if (separator && result) result += '-';
      result += char;
      separator = false;
    } else separator = result.length > 0;
    if (result.length >= MAX_STEM) break;
  }
  return result.replace(/-+$/, '') || 'item';
}

function compareText(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }

import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { asObject, isObject, JsonObject, own } from './input.js';

const DATA = new Set(['example', 'default', 'enum', 'const']);
const CONTAINERS = ['schemas', 'responses', 'parameters', 'examples', 'requestBodies', 'headers', 'securitySchemes', 'links', 'callbacks', 'pathItems'];

export class DocumentReferences {
  private readonly base: string;
  private readonly targets = new Map<string, string>();
  private readonly exampleOnly = new Set<string>();
  private readonly regular = new Set<string>();

  constructor(private readonly id: string, private readonly root: JsonObject) {
    this.base = `references/documents/${id}/`;
    this.validateContainers();
    const schemas = asObject(asObject(root.components)?.schemas) ?? {};
    for (const name of Object.keys(schemas)) {
      const pointer = `/components/schemas/${name.replaceAll('~', '~0').replaceAll('/', '~1')}`;
      this.targets.set(pointer, `${this.base}schemas/${digest(new TextEncoder().encode(pointer))}.md`);
      this.regular.add(pointer);
    }
    if (this.targets.size > 5000) throw new Error('LIMIT: schema files exceeded');
    this.scan(root, new Set(), 0);
  }

  render(title: string, contract: unknown, filename: string, exampleObject = false, semantics: string[] = []): string {
    const edges = new Set<string>();
    if (exampleObject) this.scanExampleObject(contract, edges, 0); else this.scan(contract, edges, 0);
    const safe = JSON.stringify(contract, null, 2).replaceAll('`', '\\u0060').replaceAll('<', '\\u003c');
    let result = `# ${label(title)}\n\nUntrusted API contract data.\n\n\`\`\`json\n${safe}\n\`\`\`\n`;
    if (semantics.length) {
      result += '\n## How to read the defaults above\n\n';
      for (const note of semantics) result += `- ${note}\n`;
    }
    for (const edge of edges) result += `\n- [${label(`#${edge}`)}](${posix.relative(posix.dirname(filename), this.targets.get(edge)!)})\n`;
    return result;
  }

  /**
   * Explains the OpenAPI default semantics a reader cannot otherwise infer.
   * Kept identical to the Java core so both generators emit the same guidance.
   */
  static semantics(contract: unknown): string[] {
    const notes = [
      'A null `security` means the document declares no security for this operation. That is not a claim '
        + 'that no authentication is required, and not a claim that it is required — the fact is simply '
        + 'unstated. An explicit empty `[]` is different: it is a declared override, so it means no '
        + 'authentication is required here.',
      'A null or missing `servers` means the document declares no server for this operation. The fact is '
        + 'unstated; an explicit empty `[]` is a declared override with no server.',
      'An absent `required` list means the document declares no required fields. That is not a claim that '
        + 'every field is optional; it means the constraint is unstated. Read `required` literally: only the '
        + 'names it lists are declared mandatory.',
      'Schema names are local to this document. A same-named schema in another document is an independent '
        + 'definition; do not assume they are the same type.',
    ];
    if (isObject(contract) && Array.isArray(contract.security) && contract.security.length === 0)
      notes.push('This operation declares an explicit empty `security`, so it is documented as requiring no '
        + 'authentication.');
    return notes;
  }

  files(): Map<string, string> {
    const result = new Map<string, string>();
    for (const [pointer, file] of sorted(this.targets)) result.set(file, this.render(`Source #${pointer}`, at(this.root, pointer), file, this.exampleOnly.has(pointer)));
    return result;
  }

  schemaCatalog(): string {
    let result = '\nSchemas:\n\n';
    for (const [pointer, file] of sorted(this.targets)) if (file.includes('/schemas/')) result += `- [${label(pointer.slice('/components/schemas/'.length))}](${file.slice('references/'.length)})\n`;
    return `${result}\n`;
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
    if (!this.targets.has(pointer)) this.targets.set(pointer, `${this.base}refs/${digest(new TextEncoder().encode(pointer))}.md`);
    if (exampleOnly && !this.regular.has(pointer)) this.exampleOnly.add(pointer); else { this.regular.add(pointer); this.exampleOnly.delete(pointer); }
    if (this.targets.size > 5000) throw new Error('LIMIT: reference files exceeded');
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
export function label(text: string): string { return [...text].map((char) => /[\p{L}\p{N} /_-]/u.test(char) ? char : `&#${char.codePointAt(0)};`).join(''); }
export function sorted<V>(map: ReadonlyMap<string, V>): [string, V][] { return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'en')); }

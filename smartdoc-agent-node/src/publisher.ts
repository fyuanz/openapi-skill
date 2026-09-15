import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { identity } from './generator.js';

export async function publishSkill(outputParent: string, serviceId: string, skillName: string, files: ReadonlyMap<string, string>): Promise<string> {
  identity(serviceId); identity(skillName);
  const nextKind = validateFiles(files, serviceId, skillName);
  const output = resolve(outputParent);
  if (dirname(output) === output) throw new Error('CONFIG: output parent cannot be a filesystem root');
  const skill = join(output, skillName); const state = join(output, '.smartdoc');
  const staging = join(state, 'staging', `${skillName}-${randomUUID()}`); const backup = join(state, 'backups', `${skillName}-${randomUUID()}`);
  await mkdir(staging, { recursive: true });
  let previous = false;
  try {
    if (await exists(skill)) {
      validatePreviousFiles(await readTree(skill), serviceId, skillName, nextKind);
      previous = true;
    }
    for (const [path, content] of files) { const target = join(staging, ...path.split('/')); await mkdir(dirname(target), { recursive: true }); await writeFile(target, content, { encoding: 'utf8', flag: 'wx' }); }
    validateFiles(await readTree(staging), serviceId, skillName);
    if (previous) { await mkdir(dirname(backup), { recursive: true }); await rename(skill, backup); }
    try { await mkdir(output, { recursive: true }); await rename(staging, skill); }
    catch (error) { if (previous && await exists(backup)) await rename(backup, skill); throw error; }
    if (await exists(backup)) await rm(backup, { recursive: true });
    return skill;
  } finally { if (await exists(staging)) await rm(staging, { recursive: true }); }
}

function validateFiles(files: ReadonlyMap<string, string>, ownerId: string, skillName: string): 'service' | 'project' {
  const source = validateTree(files, skillName);
  if (source.kind === 'project') {
    if (ownerId !== skillName) throw new Error('OUTPUT: project owner must match the configured Skill name');
    validateProjectSource(source, files);
    return 'project';
  }
  if (source.kind !== undefined || source.serviceId !== ownerId) throw new Error('OUTPUT: source metadata owner does not match');
  identity(source.serviceId as string);
  return 'service';
}

function validatePreviousFiles(files: ReadonlyMap<string, string>, ownerId: string, skillName: string, nextKind: 'service' | 'project'): void {
  const source = validateTree(files, skillName);
  const previousKind = source.kind === 'project' ? 'project' : 'service';
  if (previousKind === 'project') validateProjectSource(source, files);
  else {
    if (source.kind !== undefined) throw new Error('OUTPUT: unsupported generated Skill kind');
    identity(source.serviceId as string);
  }
  if (previousKind === nextKind && previousKind === 'service' && source.serviceId !== ownerId) {
    throw new Error('OUTPUT: existing Skill owner does not match');
  }
}

function validateTree(files: ReadonlyMap<string, string>, skillName: string): Record<string, unknown> {
  if (!files.size || files.size > 10_000) throw new Error('OUTPUT: generated file set is empty or too large');
  const lower = new Set<string>(); let bytes = 0;
  for (const [path, content] of files) {
    if (!path || path.includes('\\') || !/^[A-Za-z0-9._/-]+$/.test(path) || isAbsolute(path) || posix.normalize(path) !== path || path.startsWith('../')) throw new Error(`OUTPUT: unsafe generated path ${path}`);
    if (lower.has(path.toLowerCase())) throw new Error(`OUTPUT: case-insensitive path collision at ${path}`); lower.add(path.toLowerCase());
    bytes += Buffer.byteLength(content); if (bytes > 64 * 1024 * 1024) throw new Error('OUTPUT: generated content exceeds 64 MiB');
  }
  const entry = files.get('SKILL.md');
  if (!entry?.startsWith(`---\nname: ${skillName}\ndescription: `)) throw new Error('OUTPUT: SKILL.md frontmatter does not match the configured Skill');
  const frontmatterEnd = entry.indexOf('\n---\n');
  if (frontmatterEnd < 0) throw new Error('OUTPUT: SKILL.md frontmatter is not closed');
  const description = entry.slice(entry.indexOf('description: ') + 13, frontmatterEnd);
  if (!description || description.length > 1024 || description.includes('\n') || description.includes('\r') || description.includes(': ')) throw new Error('OUTPUT: Skill description is invalid');
  let source: unknown; try { source = JSON.parse(files.get('references/source.json') ?? ''); } catch { throw new Error('OUTPUT: references/source.json is invalid JSON'); }
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('OUTPUT: source metadata must be an object');
  const metadata = source as Record<string, unknown>;
  if (metadata.skillName !== skillName || !['smartdoc-agent-core/1', 'smartdoc-agent-core/2'].includes(metadata.generatorVersion as string)) {
    throw new Error('OUTPUT: source metadata owner or generator does not match');
  }
  for (const [path, content] of files) if (path.endsWith('.md')) validateLinks(path, content, files);
  return metadata;
}

function validateProjectSource(source: Record<string, unknown>, files: ReadonlyMap<string, string>): void {
  if (source.generatorVersion !== 'smartdoc-agent-core/2') throw new Error('OUTPUT: project source version is invalid');
  if (source.serviceId !== undefined) throw new Error('OUTPUT: project source must not impersonate a service owner');
  if (!Array.isArray(source.services) || source.services.length === 0 || source.services.length > 32 || !Array.isArray(source.documents)) {
    throw new Error('OUTPUT: project source metadata is incomplete');
  }
  const ids = new Set<string>(); const expectedDocuments = new Set<string>();
  let previousId = '';
  for (const raw of source.services) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('OUTPUT: project service metadata is invalid');
    const service = raw as Record<string, unknown>;
    identity(service.serviceId as string);
    if (ids.has(service.serviceId as string)) throw new Error('OUTPUT: duplicate project service metadata');
    ids.add(service.serviceId as string);
    if (previousId && previousId.localeCompare(service.serviceId as string, 'en') >= 0) throw new Error('OUTPUT: project services are not sorted');
    previousId = service.serviceId as string;
    if (service.sourceType !== 'internal' && service.sourceType !== 'third-party') throw new Error('OUTPUT: project sourceType is invalid');
    if (!Array.isArray(service.documents) || service.documents.length === 0) throw new Error('OUTPUT: project service documents are missing');
    const nested = files.get(`references/services/${service.serviceId}/references/source.json`);
    if (!nested) throw new Error(`OUTPUT: project service source missing for ${service.serviceId}`);
    let nestedSource: Record<string, unknown>;
    try { nestedSource = JSON.parse(nested) as Record<string, unknown>; } catch { throw new Error(`OUTPUT: project service source is invalid for ${service.serviceId}`); }
    if (nestedSource.serviceId !== service.serviceId) throw new Error(`OUTPUT: project service owner mismatch for ${service.serviceId}`);
    if (JSON.stringify(nestedSource) !== JSON.stringify(service)) throw new Error(`OUTPUT: project service provenance mismatch for ${service.serviceId}`);
    for (const document of service.documents) {
      if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('OUTPUT: project document metadata is invalid');
      const documentId = (document as Record<string, unknown>).documentId;
      identity(documentId as string);
      expectedDocuments.add(`${service.serviceId}/${documentId}`);
    }
  }
  const actualDocuments = new Set<string>();
  for (const document of source.documents) {
    if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('OUTPUT: flattened project document metadata is invalid');
    const entry = document as Record<string, unknown>;
    identity(entry.serviceId as string); identity(entry.documentId as string);
    if (entry.sourceType !== 'internal' && entry.sourceType !== 'third-party') throw new Error('OUTPUT: flattened project sourceType is invalid');
    actualDocuments.add(`${entry.serviceId}/${entry.documentId}`);
  }
  if (actualDocuments.size !== expectedDocuments.size || [...expectedDocuments].some((document) => !actualDocuments.has(document))) {
    throw new Error('OUTPUT: flattened project documents do not match services');
  }
  if ([...files.keys()].some((path) => path !== 'SKILL.md' && path.endsWith('/SKILL.md'))) throw new Error('OUTPUT: nested Skill entrypoints are not allowed');
}

function validateLinks(path: string, content: string, files: ReadonlyMap<string, string>): void {
  let fenced = false;
  for (const line of content.split(/\r?\n/)) {
    if (line.trimStart().startsWith('```')) { fenced = !fenced; continue; }
    if (fenced) continue;
    for (const match of line.matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1]!;
      if (!target || target.includes('\\') || target.includes(':') || target.startsWith('/')) throw new Error(`OUTPUT: unsafe link in ${path}: ${target}`);
      const resolved = posix.normalize(posix.join(posix.dirname(path), target));
      if (resolved.startsWith('../') || !files.has(resolved)) throw new Error(`OUTPUT: unresolved link in ${path}: ${target}`);
    }
  }
  if (fenced) throw new Error(`OUTPUT: unclosed code fence in ${path}`);
}

async function readTree(root: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('symbolic links are not allowed in a generated Skill');
      if (entry.isDirectory()) await walk(path); else if (entry.isFile()) result.set(relative(root, path).split(sep).join('/'), await readFile(path, 'utf8')); else throw new Error('unsupported filesystem entry in generated Skill');
    }
  }
  await walk(root); return new Map([...result].sort(([a], [b]) => a.localeCompare(b, 'en')));
}

async function exists(path: string): Promise<boolean> { try { await access(path, constants.F_OK); return true; } catch { return false; } }

import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { identity } from './generator.js';

export async function publishSkill(outputParent: string, serviceId: string, skillName: string, files: ReadonlyMap<string, string>): Promise<string> {
  identity(serviceId); identity(skillName); validateFiles(files, serviceId, skillName);
  const output = resolve(outputParent);
  if (dirname(output) === output) throw new Error('CONFIG: output parent cannot be a filesystem root');
  const skill = join(output, skillName); const state = join(output, '.smartdoc');
  const staging = join(state, 'staging', `${skillName}-${randomUUID()}`); const backup = join(state, 'backups', `${skillName}-${randomUUID()}`);
  await mkdir(staging, { recursive: true });
  let previous = false;
  try {
    if (await exists(skill)) { validateFiles(await readTree(skill), serviceId, skillName); previous = true; }
    for (const [path, content] of files) { const target = join(staging, ...path.split('/')); await mkdir(dirname(target), { recursive: true }); await writeFile(target, content, { encoding: 'utf8', flag: 'wx' }); }
    validateFiles(await readTree(staging), serviceId, skillName);
    if (previous) { await mkdir(dirname(backup), { recursive: true }); await rename(skill, backup); }
    try { await mkdir(output, { recursive: true }); await rename(staging, skill); }
    catch (error) { if (previous && await exists(backup)) await rename(backup, skill); throw error; }
    if (await exists(backup)) await rm(backup, { recursive: true });
    return skill;
  } finally { if (await exists(staging)) await rm(staging, { recursive: true }); }
}

function validateFiles(files: ReadonlyMap<string, string>, serviceId: string, skillName: string): void {
  if (!files.size || files.size > 10_000) throw new Error('OUTPUT: generated file set is empty or too large');
  const lower = new Set<string>(); let bytes = 0;
  for (const [path, content] of files) {
    if (!path || path.includes('\\') || !/^[A-Za-z0-9._/-]+$/.test(path) || isAbsolute(path) || posix.normalize(path) !== path || path.startsWith('../')) throw new Error(`OUTPUT: unsafe generated path ${path}`);
    if (lower.has(path.toLowerCase())) throw new Error(`OUTPUT: case-insensitive path collision at ${path}`); lower.add(path.toLowerCase());
    bytes += Buffer.byteLength(content); if (bytes > 64 * 1024 * 1024) throw new Error('OUTPUT: generated content exceeds 64 MiB');
  }
  const entry = files.get('SKILL.md');
  if (!entry?.startsWith(`---\nname: ${skillName}\ndescription: `)) throw new Error('OUTPUT: SKILL.md frontmatter does not match the configured Skill');
  let source: unknown; try { source = JSON.parse(files.get('references/source.json') ?? ''); } catch { throw new Error('OUTPUT: references/source.json is invalid JSON'); }
  if (!source || typeof source !== 'object' || (source as { serviceId?: unknown }).serviceId !== serviceId || (source as { skillName?: unknown }).skillName !== skillName) throw new Error('OUTPUT: source metadata owner does not match');
  for (const [path, content] of files) if (path.endsWith('.md')) validateLinks(path, content, files);
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

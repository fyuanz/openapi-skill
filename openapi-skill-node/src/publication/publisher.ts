import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { identity } from '../config/identity.js';
import { validateFiles, validatePreviousFiles } from './validation.js';

export async function publishSkill(outputParent: string, serviceId: string, skillName: string, files: ReadonlyMap<string, string>): Promise<string> {
  identity(serviceId); identity(skillName);
  const nextKind = validateFiles(files, serviceId, skillName);
  const output = resolve(outputParent);
  if (dirname(output) === output) throw new Error('CONFIG: output parent cannot be a filesystem root');
  const skill = join(output, skillName); const state = join(output, '.openapi-skill');
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
    catch (error) {
      if (previous && await exists(backup)) {
        try { await rename(backup, skill); }
        catch (recoveryError) {
          throw new Error(`OUTPUT: publication and recovery failed; previous Skill retained at ${backup}`, {
            cause: new AggregateError([error, recoveryError], 'publication and recovery failed')
          });
        }
      }
      throw error;
    }
    if (await exists(backup)) await rm(backup, { recursive: true });
    return skill;
  } finally {
    try { if (await exists(staging)) await rm(staging, { recursive: true }); }
    finally {
      // Never recursively remove shared state: other attempts or recovery backups may still need it.
      for (const directory of [dirname(staging), dirname(backup), state]) {
        try { await rmdir(directory); }
        catch { /* Best effort only: non-empty, busy or inaccessible state must remain intact. */ }
      }
    }
  }
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

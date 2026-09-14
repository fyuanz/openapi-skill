import { readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { identity } from './generator.js';
import { SmartDocConfig } from './types.js';

export async function loadConfig(cwd: string, explicit?: string): Promise<SmartDocConfig> {
  const candidates = explicit ? [resolve(cwd, explicit)] : [join(cwd, 'smartdoc-agent.config.json'), join(cwd, 'package.json')];
  let raw: unknown; let selected = '';
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(await readFile(candidate, 'utf8')) as { smartdocAgent?: unknown };
      raw = candidate.endsWith('package.json') ? parsed.smartdocAgent : parsed; selected = candidate;
      if (raw !== undefined) break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`CONFIG: cannot read ${candidate}: ${message(error)}`, { cause: error });
    }
  }
  if (!raw || typeof raw !== 'object') throw new Error(`CONFIG: no SmartDoc configuration found in ${candidates.join(' or ')}`);
  const value = raw as Partial<SmartDocConfig>;
  identity(value.serviceId as string); identity(value.skillName as string);
  if (!Array.isArray(value.documents) || value.documents.length === 0 || value.documents.length > 32) throw new Error('CONFIG: documents must contain 1 to 32 sources');
  const ids = new Set<string>();
  for (const source of value.documents) {
    if (!source || typeof source !== 'object') throw new Error('CONFIG: each document requires id and url');
    identity(source.id);
    if (ids.has(source.id)) throw new Error(`CONFIG: duplicate document id ${source.id}`); ids.add(source.id);
    let url: URL; try { url = new URL(source.url); } catch { throw new Error(`CONFIG: invalid URL for ${source.id}`); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`CONFIG: ${source.id} URL must use http or https`);
  }
  if (value.timeoutMs !== undefined && (!Number.isInteger(value.timeoutMs) || value.timeoutMs <= 0)) throw new Error('CONFIG: timeoutMs must be a positive integer');
  const output = value.output ?? join('.agents', 'skills');
  return { serviceId: value.serviceId!, skillName: value.skillName!, documents: value.documents, output: isAbsolute(output) ? output : resolve(cwd, output), timeoutMs: value.timeoutMs ?? 30_000 };
}

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

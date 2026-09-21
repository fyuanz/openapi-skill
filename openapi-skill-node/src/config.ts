import { readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { identity } from './generator.js';
import { normalizeKeywords } from './keywords.js';
import { DocumentSourceKind, ResolvedDocumentSource, ResolvedServiceSource, ResolvedOpenApiSkillConfig, SourceType } from './types.js';

export async function loadConfig(cwd: string, explicit?: string): Promise<ResolvedOpenApiSkillConfig> {
  const candidates = explicit ? [resolve(cwd, explicit)] : [join(cwd, 'openapi-skill.config.json'), join(cwd, 'package.json')];
  let raw: unknown;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(await readFile(candidate, 'utf8')) as { openapiSkill?: unknown };
      raw = candidate.endsWith('package.json') ? parsed.openapiSkill : parsed;
      if (raw !== undefined) break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`CONFIG: cannot read ${candidate}: ${message(error)}`, { cause: error });
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`CONFIG: no OpenAPI Skill configuration found in ${candidates.join(' or ')}`);
  const value = raw as Record<string, unknown>;
  const hasServices = Object.prototype.hasOwnProperty.call(value, 'services');
  if (hasServices && (Object.prototype.hasOwnProperty.call(value, 'serviceId') || Object.prototype.hasOwnProperty.call(value, 'documents'))) {
    throw new Error('CONFIG: services cannot be combined with top-level serviceId or documents');
  }
  if (!hasServices && value.skillName === undefined) throw new Error('CONFIG: legacy single-service skillName is required');
  const skillName = value.skillName === undefined ? 'api-docs' : value.skillName;
  identity(skillName as string);
  const keywords = normalizeKeywords(value.keywords, hasServices ? 'project' : 'service');
  const mode = hasServices ? 'project' : 'legacy';
  const services = hasServices ? parseServices(cwd, value.services) : [parseLegacyService(cwd, value, keywords)];
  if (services.reduce((sum, service) => sum + service.documents.length, 0) > 32) throw new Error('CONFIG: project must contain at most 32 documents');
  const timeoutMs = value.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeoutMs) || (timeoutMs as number) <= 0 || (timeoutMs as number) > 2_147_483_647) throw new Error('CONFIG: timeoutMs must be a positive safe timer integer');
  const output = value.output ?? join('.agents', 'skills');
  if (typeof output !== 'string' || output.trim() === '') throw new Error('CONFIG: output must be a non-empty path');
  return {
    mode, skillName: skillName as string, keywords, services,
    output: isAbsolute(output) ? output : resolve(cwd, output), timeoutMs: timeoutMs as number
  };
}

function parseServices(cwd: string, value: unknown): ResolvedServiceSource[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 32) throw new Error('CONFIG: services must contain 1 to 32 members');
  const ids = new Set<string>();
  const services = value.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`CONFIG: service ${index + 1} must be an object`);
    const service = raw as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(service, 'skillName')) throw new Error('CONFIG: one project produces one Skill; use top-level skillName');
    identity(service.serviceId as string);
    const serviceId = service.serviceId as string;
    if (ids.has(serviceId)) throw new Error(`CONFIG: duplicate service id ${serviceId}`);
    ids.add(serviceId);
    const sourceType = service.sourceType ?? 'internal';
    if (sourceType !== 'internal' && sourceType !== 'third-party') throw new Error(`CONFIG: ${serviceId} sourceType must be internal or third-party`);
    return {
      serviceId, sourceType: sourceType as SourceType,
      keywords: normalizeKeywords(service.keywords, `${serviceId} service`),
      documents: parseDocuments(cwd, service.documents, serviceId)
    };
  });
  return services.sort((a, b) => a.serviceId.localeCompare(b.serviceId, 'en'));
}

function parseLegacyService(cwd: string, value: Record<string, unknown>, keywords: string[]): ResolvedServiceSource {
  identity(value.serviceId as string);
  const serviceId = value.serviceId as string;
  return { serviceId, sourceType: 'internal', keywords, documents: parseDocuments(cwd, value.documents, serviceId) };
}

function parseDocuments(cwd: string, value: unknown, serviceId: string): ResolvedDocumentSource[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 32) throw new Error(`CONFIG: ${serviceId} documents must contain 1 to 32 sources`);
  const ids = new Set<string>();
  const documents = value.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`CONFIG: ${serviceId} each document requires id and url`);
    const source = raw as Record<string, unknown>;
    identity(source.id as string);
    const id = source.id as string;
    if (ids.has(id)) throw new Error(`CONFIG: duplicate document id ${id} in service ${serviceId}`);
    ids.add(id);
    if (typeof source.url !== 'string' || source.url.trim() === '') throw new Error(`CONFIG: invalid document source for ${serviceId}/${id}`);
    const kind = remoteKind(source.url);
    if (kind === 'remote') {
      let url: URL;
      try { url = new URL(source.url); }
      catch { throw new Error(`CONFIG: invalid URL for ${serviceId}/${id}`); }
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`CONFIG: ${serviceId}/${id} URL must use http or https`);
      return { id, url: source.url, keywords: normalizeKeywords(source.keywords, `${serviceId}/${id}`), kind, path: source.url };
    }
    return {
      id, url: source.url, keywords: normalizeKeywords(source.keywords, `${serviceId}/${id}`),
      kind, path: resolve(cwd, source.url)
    };
  });
  return documents.sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

function remoteKind(value: string): DocumentSourceKind {
  return /^https?:\/\//i.test(value) ? 'remote' : 'local';
}

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

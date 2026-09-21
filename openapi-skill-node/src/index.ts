import { readFile, stat } from 'node:fs/promises';
import { generateSkill } from './generator.js';
import { generateProjectSkill } from './project-generator.js';
import { loadConfig } from './config.js';
import { publishSkill } from './publisher.js';
import { ProjectServiceInput, ResolvedDocumentSource, ResolvedOpenApiSkillConfig, RunOptions, RunResult } from './types.js';

export { generateSkill } from './generator.js';
export { generateProjectSkill } from './project-generator.js';
export { loadConfig } from './config.js';
export { publishSkill } from './publisher.js';
export type {
  DocumentSource, DocumentSourceKind, GenerateOptions, GenerateProjectOptions, LegacyOpenApiSkillConfig,
  ProjectServiceInput, ProjectOpenApiSkillConfig, ResolvedDocumentSource,
  ResolvedServiceSource, ResolvedOpenApiSkillConfig, RunOptions, RunResult,
  ServiceSource, OpenApiSkillConfig, SourceType
} from './types.js';

export async function run(options: RunOptions = {}): Promise<RunResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig(cwd, options.config);
  const services = await downloadServices(config);
  const documentCount = services.reduce((sum, service) => sum + service.documents.size, 0);
  if (config.mode === 'legacy') {
    const service = services[0]!;
    const hasKeywords = (service.keywords?.length ?? 0) > 0 || [...(service.documentKeywords?.values() ?? [])].some((keywords) => keywords.length > 0);
    const files = generateSkill({
      serviceId: service.serviceId, skillName: config.skillName, documents: service.documents,
      ...(hasKeywords ? { keywords: service.keywords, documentKeywords: service.documentKeywords } : {})
    });
    const skillDirectory = await publishSkill(config.output, service.serviceId, config.skillName, files);
    return { skillDirectory, serviceCount: 1, documentCount, fileCount: files.size };
  }
  const files = generateProjectSkill({ skillName: config.skillName, keywords: config.keywords, services });
  const skillDirectory = await publishSkill(config.output, config.skillName, config.skillName, files);
  return { skillDirectory, serviceCount: services.length, documentCount, fileCount: files.size };
}

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const MAX_PROJECT_BYTES = 32 * 1024 * 1024;

async function downloadServices(config: ResolvedOpenApiSkillConfig): Promise<ProjectServiceInput[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  let totalBytes = 0;
  const services: ProjectServiceInput[] = [];
  try {
    for (const service of config.services) {
      const documents = new Map<string, Uint8Array>();
      const documentKeywords = new Map<string, readonly string[]>();
      for (const source of service.documents) {
        const owner = `${service.serviceId}/${source.id}`;
        const bytes = await readDocumentSource(owner, source, controller.signal);
        totalBytes += bytes.byteLength;
        if (totalBytes > MAX_PROJECT_BYTES) throw new Error(`${owner}: LIMIT: project input bytes exceeded`);
        documents.set(source.id, bytes);
        documentKeywords.set(source.id, source.keywords);
      }
      services.push({
        serviceId: service.serviceId, sourceType: service.sourceType, keywords: service.keywords,
        documents, documentKeywords
      });
    }
    return services;
  } finally { clearTimeout(timeout); }
}

async function readDocumentSource(owner: string, source: ResolvedDocumentSource, signal: AbortSignal): Promise<Uint8Array> {
  return source.kind === 'remote' ? downloadDocument(owner, source.path, signal) : readLocalDocument(owner, source.path);
}

async function downloadDocument(owner: string, url: string, signal: AbortSignal): Promise<Uint8Array> {
  let response: Response;
  try { response = await fetch(url, { signal, headers: { accept: 'application/json' }, redirect: 'error' }); }
  catch (error) { throw new Error(`${owner}: DOWNLOAD: ${message(error)}`, { cause: error }); }
  if (!response.ok) throw new Error(`${owner}: DOWNLOAD: HTTP ${response.status}`);
  const type = response.headers.get('content-type');
  if (type && !type.toLowerCase().includes('json')) throw new Error(`${owner}: DOWNLOAD: expected JSON content-type, received ${type}`);
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_DOCUMENT_BYTES) throw new Error(`${owner}: LIMIT: input bytes exceeded`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new Error(`${owner}: LIMIT: input bytes exceeded`);
  return bytes;
}

async function readLocalDocument(owner: string, path: string): Promise<Uint8Array> {
  let info;
  try { info = await stat(path); }
  catch (error) { throw new Error(`${owner}: LOCAL: ${message(error)}`, { cause: error }); }
  if (!info.isFile()) throw new Error(`${owner}: LOCAL: expected a regular file`);
  if (info.size > MAX_DOCUMENT_BYTES) throw new Error(`${owner}: LIMIT: input bytes exceeded`);
  let bytes: Buffer;
  try { bytes = await readFile(path); }
  catch (error) { throw new Error(`${owner}: LOCAL: ${message(error)}`, { cause: error }); }
  const output = new Uint8Array(bytes);
  if (output.byteLength > MAX_DOCUMENT_BYTES) throw new Error(`${owner}: LIMIT: input bytes exceeded`);
  return output;
}

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

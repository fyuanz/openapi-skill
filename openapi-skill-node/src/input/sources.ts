import { OperationAliases } from '../config/aliases.js';
import { readFile, stat } from 'node:fs/promises';
import { ProjectServiceInput, ResolvedDocumentSource, ResolvedOpenApiSkillConfig } from '../config/types.js';

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const MAX_PROJECT_BYTES = 32 * 1024 * 1024;

export async function downloadServices(config: ResolvedOpenApiSkillConfig): Promise<ProjectServiceInput[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  let totalBytes = 0;
  const services: ProjectServiceInput[] = [];
  try {
    for (const service of config.services) {
      const documents = new Map<string, Uint8Array>();
      const documentKeywords = new Map<string, readonly string[]>();
      const documentOperationAliases = new Map<string, OperationAliases>();
      for (const source of service.documents) {
        const owner = `${service.serviceId}/${source.id}`;
        const bytes = await readDocumentSource(owner, source, controller.signal);
        totalBytes += bytes.byteLength;
        if (totalBytes > MAX_PROJECT_BYTES) throw new Error(`${owner}: LIMIT: project input bytes exceeded`);
        documents.set(source.id, bytes);
        documentKeywords.set(source.id, source.keywords);
        documentOperationAliases.set(source.id, source.operationAliases ?? {});
      }
      services.push({
        serviceId: service.serviceId, sourceType: service.sourceType, keywords: service.keywords,
        documents, documentKeywords, documentOperationAliases
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

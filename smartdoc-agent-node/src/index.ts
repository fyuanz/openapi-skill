import { generateSkill } from './generator.js';
import { loadConfig } from './config.js';
import { publishSkill } from './publisher.js';
import { RunOptions, RunResult, SmartDocConfig } from './types.js';

export { generateSkill } from './generator.js';
export { loadConfig } from './config.js';
export { publishSkill } from './publisher.js';
export type { DocumentSource, GenerateOptions, RunOptions, RunResult, SmartDocConfig } from './types.js';

export async function run(options: RunOptions = {}): Promise<RunResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig(cwd, options.config);
  const documents = await downloadDocuments(config);
  const files = generateSkill({ serviceId: config.serviceId, skillName: config.skillName, documents });
  const skillDirectory = await publishSkill(config.output!, config.serviceId, config.skillName, files);
  return { skillDirectory, documentCount: documents.size, fileCount: files.size };
}

async function downloadDocuments(config: SmartDocConfig): Promise<Map<string, Uint8Array>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const entries = await Promise.all(config.documents.map(async ({ id, url }) => {
      let response: Response;
      try { response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' }, redirect: 'error' }); }
      catch (error) { throw new Error(`${id}: DOWNLOAD: ${message(error)}`, { cause: error }); }
      if (!response.ok) throw new Error(`${id}: DOWNLOAD: HTTP ${response.status}`);
      const type = response.headers.get('content-type');
      if (type && !type.toLowerCase().includes('json')) throw new Error(`${id}: DOWNLOAD: expected JSON content-type, received ${type}`);
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > 8 * 1024 * 1024) throw new Error(`${id}: LIMIT: input bytes exceeded`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 8 * 1024 * 1024) throw new Error(`${id}: LIMIT: input bytes exceeded`);
      return [id, bytes] as const;
    }));
    return new Map(entries.sort(([a], [b]) => a.localeCompare(b, 'en')));
  } finally { clearTimeout(timeout); }
}

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

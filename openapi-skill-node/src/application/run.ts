import { downloadServices } from '../input/sources.js';
import { join } from 'node:path';
import { generateSkill } from '../generation/service.js';
import { generateProjectSkill } from '../generation/project.js';
import { loadConfig } from '../config/load.js';
import { publishSkill } from '../publication/publisher.js';
import { MultiOutputPublishError, OutputPublicationResult } from '../publication/result.js';
import { RunOptions, RunResult } from '../config/types.js';

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
      ...(service.documentOperationAliases ? { documentOperationAliases: service.documentOperationAliases } : {}),
      ...(hasKeywords ? { keywords: service.keywords, documentKeywords: service.documentKeywords } : {})
    });
    const skillDirectories = await publishOutputs(config.outputs, service.serviceId, config.skillName, files);
    return { skillDirectory: skillDirectories[0]!, skillDirectories, serviceCount: 1, documentCount, fileCount: files.size };
  }
  const files = generateProjectSkill({ skillName: config.skillName, keywords: config.keywords, services });
  const skillDirectories = await publishOutputs(config.outputs, config.skillName, config.skillName, files);
  return { skillDirectory: skillDirectories[0]!, skillDirectories, serviceCount: services.length, documentCount, fileCount: files.size };
}

async function publishOutputs(outputs: readonly string[], ownerId: string, skillName: string,
  files: ReadonlyMap<string, string>): Promise<string[]> {
  const results: OutputPublicationResult[] = [];
  for (const output of outputs) {
    const skillDirectory = joinOutput(output, skillName);
    try {
      results.push({ skillDirectory: await publishSkill(output, ownerId, skillName, files), status: 'success' });
    } catch (error) {
      results.push({ skillDirectory, status: 'failed', error });
    }
  }
  if (results.some((result) => result.status === 'failed')) throw new MultiOutputPublishError(results);
  return results.map((result) => result.skillDirectory);
}

function joinOutput(output: string, skillName: string): string {
  return join(output, skillName);
}

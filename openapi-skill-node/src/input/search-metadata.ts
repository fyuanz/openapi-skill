import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { SearchOptions, SearchResult, searchSkill } from '../discovery/search.js';

export async function searchSkillDirectory(directory: string, options: SearchOptions): Promise<SearchResult> {
  const files = new Map<string, string>();
  for (const name of ['references/source.json', 'references/operations.jsonl']) {
    const path = join(directory, name);
    const info = await stat(path);
    if (!info.isFile() || info.size > 64 * 1024 * 1024) throw new Error('OUTPUT: search metadata missing or oversized');
    files.set(name, await readFile(path, 'utf8'));
  }
  return searchSkill(files, options);
}

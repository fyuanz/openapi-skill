import { SearchOptions, validateSearchOptions } from '../discovery/search.js';
import { searchSkillDirectory } from '../input/search-metadata.js';
import { formatDiagnostic, normalizeDiagnostic } from '../diagnostics/errors.js';

const USAGE = 'Usage: openapi-skill search <query> --skill <directory> [--service <id>] [--document <id>] [--limit 1..100] [--offset 0..n]';

export async function searchCommand(args: string[]): Promise<void> {
  let directory: string, options: SearchOptions;
  try {
    const query = args[0];
    if (!query || query.startsWith('--')) throw new Error('query');
    const flags = new Map<string, string>();
    for (let i = 1; i < args.length; i += 2) {
      const name = args[i]!, value = args[i + 1];
      if (!['--skill', '--service', '--document', '--limit', '--offset'].includes(name)
        || flags.has(name) || !value || value.startsWith('--')) throw new Error('flag');
      flags.set(name, value);
    }
    if (!flags.get('--skill')) throw new Error('directory');
    for (const key of ['--limit', '--offset']) if (flags.has(key) && !/^\d+$/.test(flags.get(key)!)) throw new Error('number');
    directory = flags.get('--skill')!;
    options = { query,
      ...(flags.has('--service') ? { service: flags.get('--service')! } : {}),
      ...(flags.has('--document') ? { document: flags.get('--document')! } : {}),
      ...(flags.has('--limit') ? { limit: Number(flags.get('--limit')) } : {}),
      ...(flags.has('--offset') ? { offset: Number(flags.get('--offset')) } : {}) };
    validateSearchOptions(options);
  } catch { console.error(USAGE); process.exitCode = 2; return; }
  try { console.log(JSON.stringify(await searchSkillDirectory(directory, options))); }
  catch (error) { console.error(formatDiagnostic(normalizeDiagnostic(error))); process.exitCode = 1; }
}

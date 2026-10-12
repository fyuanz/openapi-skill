import { run } from './run.js';
import { formatDebugChain, formatDiagnostic, formatMultiOutputDiagnostic, normalizeDiagnostic } from '../diagnostics/errors.js';
import { MultiOutputPublishError } from '../publication/result.js';

export function generateCommand(args: string[]): void {
  let config: string | undefined;
  let debug = false;
  let invalid = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--debug' && !debug) debug = true;
    else if (arg === '--config' && config === undefined && args[index + 1] && !args[index + 1]!.startsWith('--')) config = args[++index];
    else { invalid = true; break; }
  }
  if (invalid) {
    console.error('Usage: openapi-skill [--config <path>] [--debug]');
    process.exitCode = 2;
  }
  if (process.exitCode === undefined) {
    run(config ? { config } : {}).then((result) => {
      if (result.skillDirectories.length === 1) {
        console.log(`Generated ${result.serviceCount} service(s) and ${result.documentCount} OpenAPI document(s) into ${result.skillDirectory} (${result.fileCount} files).`);
      } else {
        console.log(`Generated ${result.serviceCount} service(s) and ${result.documentCount} OpenAPI document(s) into ${result.skillDirectories.length} output(s) (${result.fileCount} files each):\n${result.skillDirectories.map((directory) => `- ${directory}`).join('\n')}`);
      }
    }).catch((error: unknown) => {
      console.error(error instanceof MultiOutputPublishError ? formatMultiOutputDiagnostic(error) : formatDiagnostic(normalizeDiagnostic(error)));
      if (debug) console.error(formatDebugChain(error));
      process.exitCode = 1;
    });
  }

}

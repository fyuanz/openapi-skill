#!/usr/bin/env node
import { run } from './index.js';
import { formatDebugChain, formatDiagnostic, normalizeDiagnostic } from './diagnostics.js';

const args = process.argv.slice(2);
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
    console.log(`Generated ${result.serviceCount} service(s) and ${result.documentCount} OpenAPI document(s) into ${result.skillDirectory} (${result.fileCount} files).`);
  }).catch((error: unknown) => {
    console.error(formatDiagnostic(normalizeDiagnostic(error)));
    if (debug) console.error(formatDebugChain(error));
    process.exitCode = 1;
  });
}

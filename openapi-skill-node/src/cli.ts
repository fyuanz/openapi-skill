#!/usr/bin/env node
import { run } from './index.js';

const args = process.argv.slice(2);
let config: string | undefined;
if (args.length) {
  if (args.length !== 2 || args[0] !== '--config' || !args[1]) {
    console.error('Usage: openapi-skill [--config <path>]'); process.exitCode = 2;
  } else config = args[1];
}
if (process.exitCode === undefined) {
  run(config ? { config } : {}).then((result) => {
    console.log(`Generated ${result.serviceCount} service(s) and ${result.documentCount} OpenAPI document(s) into ${result.skillDirectory} (${result.fileCount} files).`);
  }).catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}

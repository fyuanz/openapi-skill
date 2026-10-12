import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
if (relative(root, output) !== 'dist') throw new Error('Refusing to clean outside the package dist directory');
rmSync(output, { recursive: true, force: true });
execFileSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', resolve(root, 'tsconfig.json')], { stdio: 'inherit' });

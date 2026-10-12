#!/usr/bin/env node
import { generateCommand } from './application/generate-command.js';
import { searchCommand } from './application/search-command.js';

const args = process.argv.slice(2);
if (args[0] === 'search') await searchCommand(args.slice(1));
else generateCommand(args);

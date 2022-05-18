#!/usr/bin/env node

import { argv } from 'node:process';
import { run } from './lib/postgrator-cli.js'; // eslint-disable-line import/extensions

run(argv).catch((e) => {
    console.log(`Error: ${e.message}`);
    process.exit(1);
});

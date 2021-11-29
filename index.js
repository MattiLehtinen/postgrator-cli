#!/usr/bin/env node

import { argv } from 'process';
import { run } from './lib/postgrator-cli.js'; // eslint-disable-line import/extensions

run(argv).catch((err) => {
    console.log(`Error: ${err.message}`);
    process.exit(1);
});

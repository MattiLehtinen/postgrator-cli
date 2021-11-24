#!/usr/bin/env node

import { run } from './lib/postgrator-cli.js'; // eslint-disable-line import/extensions
import { parse } from './lib/command-line-options.js'; // eslint-disable-line import/extensions

const options = parse();
run(options).catch((err) => {
    console.log(`Error: ${err.message}`);
    process.exit(1);
});

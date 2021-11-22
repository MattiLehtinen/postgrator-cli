#!/usr/bin/env node

import commandLineArgs from 'command-line-args';

import { run } from './lib/postgrator-cli.js'; // eslint-disable-line import/extensions
import { optionList } from './lib/command-line-options.js'; // eslint-disable-line import/extensions

const options = commandLineArgs(optionList);
run(options).catch((err) => {
    console.log(`Error: ${err.message}`);
    process.exit(1);
});

#!/usr/bin/env node

const commandLineArgs = require('command-line-args');
const postgratorCli = require('./postgrator-cli');
const commandLineOptions = require('./command-line-options');

const optionList = commandLineOptions.optionList; // eslint-disable-line prefer-destructuring

const options = commandLineArgs(optionList);
postgratorCli.run(options, (err) => {
    if (err) {
        console.log(`Error: ${err.message}`);
        process.exit(1);
    }
});

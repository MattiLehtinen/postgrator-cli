#!/usr/bin/env node

const commandLineArgs = require('command-line-args');
const postgratorCli = require('./postgrator-cli');
const commandLineOptions = require('./command-line-options');
const optionList = commandLineOptions.optionList;

const options = commandLineArgs(optionList);
postgratorCli.run(options, function(err, migrations) {
    if(err) {
        console.log("Error: " + err.message);
        process.exit(1);
    }
});

const fs = require('fs');
const getUsage = require('command-line-usage');
const postgrator = require('postgrator');
const pjson = require('./package.json');
const commandLineOptions = require('./command-line-options');


function printUsage() {
    const usage = getUsage(commandLineOptions.sections);
    console.log(usage);
}

function run(options, callback) {        
    if(options.help) {
        printUsage();
        return callback(null);
    }

    if(options.version) {
        console.log('Version: ' + pjson.version);
        return callback(null);
    }

    if(!options.to) {
        printUsage();
        return callback(new Error("Migration version number must be specified"));
        // TODO: use latest version if not set
    }

    var config;
    if(options.config) {
        const configFile = './' + options.config;
        try {        
            fs.accessSync(configFile, fs.F_OK);
        } catch (e) {                        
            return callback(new Error("Config file not found: " + configFile));
        }
        config = require(configFile);                       
    } else {
        config = {
            migrationDirectory: options['migration-directory'],
            driver: options.driver,
            host: options.host,
            port: options.port,
            database: options.database,
            username: options.username,
            password: options.password
        }
    }



    postgrator.setConfig(config);
    postgrator.migrate(options.to, function (err, migrations) {
        postgrator.endConnection(function () {
            // connection is closed, or will close in the case of SQL Server
            if(err && typeof(err) === 'string') {
                err = new Error(err);    
            }
            return callback(err, migrations);                        
        });
    });
}

module.exports.run = run;

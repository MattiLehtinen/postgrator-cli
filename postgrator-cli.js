const fs = require('fs');
const path = require('path');
const getUsage = require('command-line-usage');
const Postgrator = require('postgrator');
const pjson = require('./package.json');
const commandLineOptions = require('./command-line-options');

const defaultConfigFile = 'postgrator.json';

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

    // Search for default config file if not specified
    if(!options.config) {
        try {        
            fs.accessSync(path.join(process.cwd(), defaultConfigFile), fs.F_OK);
            options.config = defaultConfigFile;
        } catch (e) {    
            // Default config file does not exist.
        }        
    }

    const migrationDirectory = path.join(process.cwd(), options['migration-directory']);
    if (!fs.existsSync(migrationDirectory)) {
        if (options['migration-directory'] === commandLineOptions.DEFAULT_MIGRATION_DIRECTORY) {
            printUsage();
        }
        return callback(new Error(`Directory "${migrationDirectory}" does not exist.`));
    }
    
    if (!options.to && options.to !== 0) {
        options.to = 'max';
    } else {
        options.to = Number(options.to).toString();
    }

    var config;
    if(options.config) {
        const configFile = (path.isAbsolute(options.config)) ? options.config : path.join(process.cwd(), options.config);
        try {        
            fs.accessSync(configFile, fs.F_OK);
        } catch (e) {                        
            return callback(new Error("Config file not found: " + configFile));
        }
        config = require(configFile);                       
    } else {
        config = {
            migrationDirectory: migrationDirectory,
            driver: options.driver,
            host: options.host,
            port: options.port,
            database: options.database,
            username: options.username,
            password: options.password,
	        options: { encrypt: options.secure || false }
        };
    }

    let postgrator;
    try {
        postgrator = new Postgrator(config);
    } catch (err) {
        printUsage();
        return callback(err);
    }

    postgrator.on('validation-started', migration => logMessage('verifying checksum of migration ' + migration.filename));
    postgrator.on('migration-started', migration => logMessage('running ' + migration.filename));

    var databaseVersion = null;

    var migratePromise = postgrator.getMigrations()
        .then((migrations) => {
            if (!migrations || !migrations.length) {
                throw new Error(`No migration files found from "${migrationDirectory}"`);  
            }
        }).then(() => {
            return postgrator.getDatabaseVersion().catch((err) => {
                logMessage('table schemaversion does not exist - creating it.');
                return 0;
            });
        }).then((version) =>{
            databaseVersion = version;
            logMessage('version of database is: ' + version);
        }).then(() => {
            if (options.to === 'max') {
                return postgrator.getMaxVersion();
            }
            return options.to;
        }).then((version) => {
            logMessage('migrating '+ (version >= databaseVersion? 'up' : 'down') +' to ' + version);
        }).then(() => {
            return postgrator.migrate(options.to);
        });
    
    promiseToCallback(migratePromise, function (err, migrations) {
        // connection is closed, or will close in the case of SQL Server
        if(err && typeof(err) === 'string') {
            err = new Error(err);    
        }
        return callback(err, migrations);
    });
}

module.exports.run = run;


////// helpers

var promiseToCallback = function(promise, callback){
    promise
        .then(function(data) {
            process.nextTick(callback, null, data);
        }, function(err) {
            process.nextTick(callback, err);
        })
}

function logMessage(message){
    //Using the system default time locale/options for now
    var messagePrefix = '['+(new Date().toLocaleTimeString())+']';
    console.log(messagePrefix + ' ' + message);
}
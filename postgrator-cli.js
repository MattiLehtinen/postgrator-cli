const fs = require('fs');
const getUsage = require('command-line-usage');
const postgrator = require('postgrator');
const pjson = require('./package.json');
const commandLineOptions = require('./command-line-options');

const defaultConfigFile = 'postgrator.json';

function printUsage() {
    const usage = getUsage(commandLineOptions.sections);
    console.log(usage);
}

function getLatestVersion(migrationDirectory) {
	var latest = null;
    var migrationFiles;
    try {
    	migrationFiles = fs.readdirSync(migrationDirectory);
    } catch(e) {
        // Migration directory not found
        return false;
    }
	migrationFiles.forEach(function(file) {
		var m = file.split('.');
		var name = m.length >= 3 ? m.slice(2, m.length - 1).join('.') : file;
		if (m[m.length - 1] === 'sql') {
            latest = Math.max(Number(m[0]), latest);
		}
	});
    return latest;
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
            fs.accessSync(process.cwd() + '/' + defaultConfigFile, fs.F_OK);
            options.config = defaultConfigFile;
        } catch (e) {    
            // Default config file does not exist.
        }        
    }


    var migrationDirectory = process.cwd() + '/' + options['migration-directory'];
    var latest = getLatestVersion(migrationDirectory);
    if(!options.to) {
        if(!latest) {
            printUsage();
        } else {
            options.to = latest;
        }                
    }
    if(!latest) {
            return callback(new Error("No migration files found from " + migrationDirectory));        
    }

    var config;
    if(options.config) {
        const configFile = process.cwd() + '/' + options.config;
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
	    options: { encrypt: true }
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

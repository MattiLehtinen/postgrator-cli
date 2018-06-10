const fs = require('fs');
const path = require('path');
const getUsage = require('command-line-usage');
const Postgrator = require('postgrator');
const pjson = require('./package.json');
const commandLineOptions = require('./command-line-options');

const defaultConfigFile = 'postgrator.json';

/* --- Helpers --- */

function printUsage() {
    const usage = getUsage(commandLineOptions.sections);
    console.log(usage);
}
function promiseToCallback(promise, callback) {
    promise.then((data) => {
        process.nextTick(callback, null, data);
    }, (err) => {
        process.nextTick(callback, err);
    });
}

function logMessage(message) {
    // Using the system default time locale/options for now
    const messagePrefix = `[${new Date().toLocaleTimeString()}]`;
    console.log(`${messagePrefix} ${message}`);
}

/* --- Main --- */

function run(options, callback) {
    if (options.help) {
        printUsage();
        callback(null);
        return;
    }

    if (options.version) {
        console.log(`Version: ${pjson.version}`);
        callback(null);
        return;
    }

    // Search for default config file if not specified
    if (!options.config) {
        try {
            fs.accessSync(path.join(process.cwd(), defaultConfigFile), fs.F_OK);
            options.config = defaultConfigFile;
        } catch (e) {
            // Default config file does not exist.
        }
    }

    if (!options.to && options.to !== 0) {
        options.to = 'max';
    }
    if (options.to !== 'max') {
        options.to = Number(options.to).toString();
    }

    let config;
    if (options.config) {
        const configFile = (path.isAbsolute(options.config)) ?
            options.config :
            path.join(process.cwd(), options.config);

        try {
            fs.accessSync(configFile, fs.F_OK);
        } catch (e) {
            callback(new Error(`Config file not found: ${configFile}`));
            return;
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
            password: options.password,
            options: { encrypt: options.secure || false },
        };
    }
    if (!config.migrationDirectory) {
        config.migrationDirectory = commandLineOptions.DEFAULT_MIGRATION_DIRECTORY;
    }
    if (!path.isAbsolute(config.migrationDirectory)) {
        config.migrationDirectory = path.join(process.cwd(), config.migrationDirectory);
    }

    if (!fs.existsSync(config.migrationDirectory)) {
        if (!options.config && options['migration-directory'] === commandLineOptions.DEFAULT_MIGRATION_DIRECTORY) {
            printUsage();
        }
        callback(new Error(`Directory "${config.migrationDirectory}" does not exist.`));
        return;
    }

    let postgrator;
    try {
        postgrator = new Postgrator(config);
    } catch (err) {
        printUsage();
        callback(err);
        return;
    }

    postgrator.on('validation-started', migration => logMessage(`verifying checksum of migration ${migration.filename}`));
    postgrator.on('migration-started', migration => logMessage(`running ${migration.filename}`));

    let databaseVersion = null;

    const migratePromise = postgrator.getMigrations()
        .then((migrations) => {
            if (!migrations || !migrations.length) {
                throw new Error(`No migration files found from "${config.migrationDirectory}"`);
            }
        })
        .then(() => {
            return postgrator.getDatabaseVersion().catch(() => {
                logMessage('table schemaversion does not exist - creating it.');
                return 0;
            });
        })
        .then((version) => {
            databaseVersion = version;
            logMessage(`version of database is: ${version}`);
        })
        .then(() => {
            if (options.to === 'max') {
                return postgrator.getMaxVersion();
            }
            return options.to;
        })
        .then((version) => {
            logMessage(`migrating ${(version >= databaseVersion) ? 'up' : 'down'} to ${version}`);
        })
        .then(() => {
            return postgrator.migrate(options.to);
        });

    promiseToCallback(migratePromise, (err, migrations) => {
        // connection is closed, or will close in the case of SQL Server
        if (err && typeof err === 'string') {
            err = new Error(err);
        }
        return callback(err, migrations);
    });
}

module.exports.run = run;

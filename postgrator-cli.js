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

function getConflictingMigrations(migrations) {
    let conflictingMigrations = [];

    migrations.forEach((migrationA) => {
        const newConflicting = migrations.filter((migrationB) => {
            return areConflictingMigrations(migrationA, migrationB);
        });
        conflictingMigrations = conflictingMigrations.concat(newConflicting);
    });

    return conflictingMigrations;
}

function areConflictingMigrations(migrationA, migrationB) {
    return migrationA.action === migrationB.action
        && migrationA.version === migrationB.version
        && migrationA.filename !== migrationB.filename;
}

function getMigrationFileNames(migrations) {
    return migrations.map((migration) => migration.filename);
}

/* -------------------------- Main ---------------------------------- */

function run(commandLineArgs, callback) {
    if (commandLineArgs.help) {
        printUsage();
        callback(null);
        return;
    }

    if (commandLineArgs.version) {
        console.log(`Version: ${pjson.version}`);
        callback(null);
        return;
    }

    // Search for default config file if not specified
    if (!commandLineArgs.config) {
        try {
            fs.accessSync(path.join(process.cwd(), defaultConfigFile), fs.F_OK);
            commandLineArgs.config = defaultConfigFile;
        } catch (e) {
            // Default config file does not exist.
        }
    }

    if (!commandLineArgs.to && commandLineArgs.to !== 0) {
        commandLineArgs.to = 'max';
    }
    if (commandLineArgs.to !== 'max') {
        commandLineArgs.to = Number(commandLineArgs.to).toString();
    }

    let postgratorConfig;
    if (commandLineArgs.config) {
        const configFile = (path.isAbsolute(commandLineArgs.config))
            ? commandLineArgs.config
            : path.join(process.cwd(), commandLineArgs.config);

        try {
            fs.accessSync(configFile, fs.F_OK);
        } catch (e) {
            callback(new Error(`Config file not found: ${configFile}`));
            return;
        }
        postgratorConfig = require(configFile);
    } else {
        postgratorConfig = {
            migrationDirectory: commandLineArgs['migration-directory'],
            driver: commandLineArgs.driver,
            host: commandLineArgs.host,
            port: commandLineArgs.port,
            database: commandLineArgs.database,
            username: commandLineArgs.username,
            password: commandLineArgs.password,
            options: { encrypt: commandLineArgs.secure || false },
        };
    }
    if (!postgratorConfig.migrationDirectory) {
        postgratorConfig.migrationDirectory = commandLineOptions.DEFAULT_MIGRATION_DIRECTORY;
    }
    if (!path.isAbsolute(postgratorConfig.migrationDirectory)) {
        postgratorConfig.migrationDirectory = path.join(process.cwd(), postgratorConfig.migrationDirectory);
    }

    if (!fs.existsSync(postgratorConfig.migrationDirectory)) {
        if (!commandLineArgs.config && commandLineArgs['migration-directory'] === commandLineOptions.DEFAULT_MIGRATION_DIRECTORY) {
            printUsage();
        }
        callback(new Error(`Directory "${postgratorConfig.migrationDirectory}" does not exist.`));
        return;
    }

    const detectVersionConflicts = postgratorConfig['detect-version-conflicts'] || commandLineArgs['detect-version-conflicts'];
    delete postgratorConfig['detect-version-conflicts']; // It's not postgrator but postgrator-cli setting

    let postgrator;
    try {
        postgrator = new Postgrator(postgratorConfig);
    } catch (err) {
        printUsage();
        callback(err);
        return;
    }

    postgrator.on(
        'validation-started',
        (migration) => logMessage(`verifying checksum of migration ${migration.filename}`)
    );
    postgrator.on(
        'migration-started',
        (migration) => logMessage(`running ${migration.filename}`)
    );

    let databaseVersion = null;

    const migratePromise = postgrator.getMigrations()
        .then((migrations) => {
            if (!migrations || !migrations.length) {
                throw new Error(`No migration files found from "${postgratorConfig.migrationDirectory}"`);
            }
            if (detectVersionConflicts) {
                const conflictingMigrations = getConflictingMigrations(migrations);
                if (conflictingMigrations && conflictingMigrations.length > 0) {
                    const conflictingMigrationFileNames = getMigrationFileNames(conflictingMigrations);
                    const conflictingMigrationFileNamesString = conflictingMigrationFileNames.join('\n');
                    throw new Error(`Conflicting migration file versions:\n${conflictingMigrationFileNamesString}`);
                }
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
            if (commandLineArgs.to === 'max') {
                return postgrator.getMaxVersion();
            }
            return commandLineArgs.to;
        })
        .then((version) => {
            logMessage(`migrating ${(version >= databaseVersion) ? 'up' : 'down'} to ${version}`);
        })
        .then(() => {
            return postgrator.migrate(commandLineArgs.to);
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

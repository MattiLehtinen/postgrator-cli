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


/**
 * Gets version to migrate to as number
 * @param {string|number} to    Version or "max"
 * @param {object} postgrator
 * @returns {number} Version to migrate to
 */
function getMigrateToVersion(to, postgrator) {
    if (to === 'max') {
        return postgrator.getMaxVersion();
    }
    return to;
}

function checkMigrations(migrations, migrationDirectory, detectVersionConflicts) {
    if (!migrations || !migrations.length) {
        throw new Error(`No migration files found from "${migrationDirectory}"`);
    }
    if (detectVersionConflicts) {
        checkVersionConflicts(migrations);
    }
}

function checkVersionConflicts(migrations) {
    const conflictingMigrationFileNamesString = getConflictingMigrationFileNamesString(migrations);
    if (conflictingMigrationFileNamesString) {
        throw new Error(`Conflicting migration file versions:\n${conflictingMigrationFileNamesString}`);
    }
}

function getConflictingMigrationFileNamesString(migrations) {
    let conflictingMigrationFileNamesString = '';

    const conflictingMigrations = getConflictingMigrations(migrations);
    if (conflictingMigrations && conflictingMigrations.length > 0) {
        const conflictingMigrationFileNames = getMigrationFileNames(conflictingMigrations);
        conflictingMigrationFileNamesString = conflictingMigrationFileNames.join('\n');
    }
    return conflictingMigrationFileNamesString;
}

function getMigrationFileNames(migrations) {
    return migrations.map((migration) => migration.filename);
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

function migrate(postgrator, to, detectVersionConflicts, migrationDirectory) {
    const toVersion = getMigrateToVersion(to, postgrator);

    return postgrator.getMigrations()
        .then((migrations) => {
            checkMigrations(migrations, migrationDirectory, detectVersionConflicts);
        })
        .then(() => {
            return postgrator.getDatabaseVersion().catch(() => {
                logMessage('table schemaversion does not exist - creating it.');
                return 0;
            });
        })
        .then((databaseVersion) => {
            logMessage(`version of database is: ${databaseVersion}`);
            logMessage(`migrating ${(toVersion >= databaseVersion) ? 'up' : 'down'} to ${toVersion}`);
            return postgrator.migrate(to);
        });
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

    const migratePromise = migrate(postgrator, commandLineArgs.to, detectVersionConflicts, postgratorConfig.migrationDirectory);

    promiseToCallback(migratePromise, (err, migrations) => {
        // connection is closed, or will close in the case of SQL Server
        if (err && typeof err === 'string') {
            err = new Error(err);
        }
        return callback(err, migrations);
    });
}

module.exports.run = run;

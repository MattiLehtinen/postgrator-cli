const fs = require('fs');
const path = require('path');
const getUsage = require('command-line-usage');
const Postgrator = require('postgrator');
const pjson = require('./package.json');
const commandLineOptions = require('./command-line-options');

const DEFAULT_CONFIG_FILE = 'postgrator.json';

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

function getMigrateToNumber(toArgument) {
    if ((!toArgument && toArgument !== 0) || toArgument === 'max') {
        return 'max';
    }
    return Number(toArgument).toString();
}

function hasDefaultConfigFile() {
    const defaultConfigFilePath = path.join(process.cwd(), DEFAULT_CONFIG_FILE);
    return fileIsAccessible(defaultConfigFilePath);
}

function getPostgratorConfigFromFile(configFile) {
    const configFilePath = getAbsolutePath(configFile);
    if (!fileIsAccessible(configFilePath)) {
        throw new Error(`Config file not found: ${configFilePath}`);
    }
    return require(configFilePath);
}

function getAbsolutePath(fileOrDirectory) {
    return (path.isAbsolute(fileOrDirectory))
        ? fileOrDirectory
        : path.join(process.cwd(), fileOrDirectory);
}

function fileIsAccessible(filePath) {
    try {
        fs.accessSync(filePath, fs.F_OK);
        return true;
    } catch (e) {
        return false;
    }
}

function getPostgratorConfigFromCommandLineArgs(commandLineArgs) {
    return {
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

/**
 * Gets version to migrate to as number
 * @param {string|number} to    Version or "max"
 * @param {object} postgrator
 * @returns {Promise<number>} Version to migrate to
 */
function getMigrateToVersion(to, postgrator) {
    if (to === 'max') {
        return postgrator.getMaxVersion();
    }
    return Promise.resolve(to);
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
    let toVersion;

    return postgrator.getMigrations()
        .then((migrations) => {
            checkMigrations(migrations, migrationDirectory, detectVersionConflicts);
        })
        .then(() => {
            return getMigrateToVersion(to, postgrator);
        })
        .then((migrateToVersion) => {
            toVersion = migrateToVersion;
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

/**
 * Gets password from postgrator config or as user input
 * @param {object} postgratorConfig
 * @param {Function} callback
 * @returns {string} password
 */
function getPassword(postgratorConfig, callback) {
    if (postgratorConfig.password !== null && postgratorConfig.password !== undefined) {
        callback(postgratorConfig.password);
        return;
    }

    // Ask password if it is not set
    const readline = require('readline');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.stdoutMuted = true;

    rl.question('Password: ', (password) => {
        rl.history = rl.history.slice(1);
        rl.close();
        console.log('\n');
        callback(password);
    });

    // eslint-disable-next-line no-underscore-dangle
    rl._writeToOutput = function _writeToOutput(stringToWrite) {
        if (rl.stdoutMuted) {
            switch (stringToWrite) {
            case '\u0004':
            case '\n':
            case '\r':
            case '\r\n':
                break;
            default:
                rl.output.write('*');
            }
        } else {
            rl.output.write(stringToWrite);
        }
    };
}

/* -------------------------- Main ---------------------------------- */

function run(commandLineArgs, callback) {
    // Print help if requested
    if (commandLineArgs.help) {
        printUsage();
        callback(null);
        return;
    }

    // Print version if requested
    if (commandLineArgs.version) {
        console.log(`Version: ${pjson.version}`);
        callback(null);
        return;
    }

    // Search for default config file if not specified
    if (!commandLineArgs.config && hasDefaultConfigFile()) {
        commandLineArgs.config = DEFAULT_CONFIG_FILE;
    }

    let postgratorConfig;
    if (commandLineArgs.config) {
        try {
            postgratorConfig = getPostgratorConfigFromFile(commandLineArgs.config);
        } catch (err) {
            callback(err);
            return;
        }
    } else {
        postgratorConfig = getPostgratorConfigFromCommandLineArgs(commandLineArgs);
    }
    if (!postgratorConfig.migrationDirectory) {
        postgratorConfig.migrationDirectory = commandLineOptions.DEFAULT_MIGRATION_DIRECTORY;
    }
    postgratorConfig.migrationDirectory = getAbsolutePath(postgratorConfig.migrationDirectory);

    if (!fs.existsSync(postgratorConfig.migrationDirectory)) {
        if (!commandLineArgs.config && commandLineArgs['migration-directory'] === commandLineOptions.DEFAULT_MIGRATION_DIRECTORY) {
            printUsage();
        }
        callback(new Error(`Directory "${postgratorConfig.migrationDirectory}" does not exist.`));
        return;
    }

    const detectVersionConflicts = postgratorConfig['detect-version-conflicts'] || commandLineArgs['detect-version-conflicts'];
    delete postgratorConfig['detect-version-conflicts']; // It's not postgrator but postgrator-cli setting

    const migrateTo = getMigrateToNumber(commandLineArgs.to);

    getPassword(postgratorConfig, (password) => {
        postgratorConfig.password = password;

        // Create postgrator
        let postgrator;
        try {
            postgrator = new Postgrator(postgratorConfig);
        } catch (err) {
            printUsage();
            callback(err);
            return;
        }

        // Postgrator events
        postgrator.on(
            'validation-started',
            (migration) => logMessage(`verifying checksum of migration ${migration.filename}`)
        );
        postgrator.on(
            'migration-started',
            (migration) => logMessage(`running ${migration.filename}`)
        );

        const migratePromise = migrate(postgrator, migrateTo, detectVersionConflicts, postgratorConfig.migrationDirectory);

        promiseToCallback(migratePromise, (err, migrations) => {
            // connection is closed, or will close in the case of SQL Server
            if (err && typeof err === 'string') {
                err = new Error(err);
            }
            return callback(err, migrations);
        });
    });
}

module.exports.run = run;

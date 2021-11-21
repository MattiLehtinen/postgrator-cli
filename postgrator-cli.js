import { existsSync, readFileSync } from 'fs';
import path from 'path';
import getUsage from 'command-line-usage';
import Postgrator from 'postgrator';
import { cosmiconfig } from 'cosmiconfig';
import { DEFAULT_MIGRATION_DIRECTORY, sections } from './command-line-options.js'; // eslint-disable-line import/extensions

const pjson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

function printUsage() {
    const usage = getUsage(sections);
    console.log(usage);
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

function getAbsolutePath(fileOrDirectory) {
    return (path.isAbsolute(fileOrDirectory))
        ? fileOrDirectory
        : path.join(process.cwd(), fileOrDirectory);
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

function checkMigrations(migrations, migrationDirectory) {
    if (!migrations || !migrations.length) {
        throw new Error(`No migration files found from "${migrationDirectory}"`);
    }
}

function migrate(postgrator, to, migrationDirectory) {
    let toVersion;

    return postgrator.getMigrations()
        .then((migrations) => {
            checkMigrations(migrations, migrationDirectory);
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
 * @returns {string} Promise<password>
 */
async function getPassword(postgratorConfig) {
    if (postgratorConfig.password !== null && postgratorConfig.password !== undefined) {
        return postgratorConfig.password;
    }

    // Ask password if it is not set
    const readline = (await import('readline')).default;

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.stdoutMuted = true;

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

    const password = await new Promise((res) => { rl.question('Password: ', res); });
    rl.history = rl.history.slice(1);
    rl.close();
    console.log('\n');
    return password;
}

/* -------------------------- Main ---------------------------------- */

// eslint-disable-next-line import/prefer-default-export
export async function run(commandLineArgs) {
    // Print help if requested
    if (commandLineArgs.help) {
        printUsage();
        return Promise.resolve();
    }

    // Print version if requested
    if (commandLineArgs.version) {
        console.log(`Version: ${pjson.version}`);
        return Promise.resolve();
    }

    let postgratorConfig = getPostgratorConfigFromCommandLineArgs(commandLineArgs);
    if (!commandLineArgs['no-config']) {
        const explorer = cosmiconfig('postgrator');
        const result = await explorer.search();
        postgratorConfig = (!result || result.isEmpty) ? postgratorConfig : result.config;
    }

    if (!postgratorConfig.migrationDirectory) {
        postgratorConfig.migrationDirectory = DEFAULT_MIGRATION_DIRECTORY;
    }
    postgratorConfig.migrationDirectory = getAbsolutePath(postgratorConfig.migrationDirectory);

    if (!existsSync(postgratorConfig.migrationDirectory)) {
        if (!commandLineArgs.config && commandLineArgs['migration-directory'] === DEFAULT_MIGRATION_DIRECTORY) {
            printUsage();
        }
        return Promise.reject(new Error(`Directory "${postgratorConfig.migrationDirectory}" does not exist.`));
    }

    const migrateTo = getMigrateToNumber(commandLineArgs.to);

    postgratorConfig.password = await getPassword(postgratorConfig);

    // Create postgrator
    let postgrator;
    try {
        postgrator = new Postgrator(postgratorConfig);
    } catch (err) {
        printUsage();
        return Promise.reject(err);
    }

    // Postgrator events
    postgrator.on(
        'validation-started',
        (migration) => logMessage(`verifying checksum of migration ${migration.filename}`),
    );
    postgrator.on(
        'migration-started',
        (migration) => logMessage(`running ${migration.filename}`),
    );

    return migrate(postgrator, migrateTo, postgratorConfig.migrationDirectory)
        .catch((err) => Promise.reject(err && typeof err === 'string' ? new Error(err) : err));
}

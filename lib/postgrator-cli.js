import { readFileSync } from 'fs';
import path from 'path';
import getUsage from 'command-line-usage';
import Postgrator from 'postgrator';
import { cosmiconfig } from 'cosmiconfig';
import tap from 'p-tap';
import getClient from './clients/index.js'; // eslint-disable-line import/extensions
import { DEFAULT_MIGRATION_PATTERN, sections } from './command-line-options.js'; // eslint-disable-line import/extensions

const pjson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));

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
        driver: commandLineArgs.driver,
        database: commandLineArgs.database,
        migrationPattern: commandLineArgs['migration-pattern'],
        schemaTable: commandLineArgs['schema-table'],
        validateChecksum: commandLineArgs['validate-checksum'],
    };
}

function getClientConfigFromCommandLineArgs(commandLineArgs) {
    return {
        host: commandLineArgs.host,
        port: commandLineArgs.port,
        database: commandLineArgs.database,
        username: commandLineArgs.username,
        password: commandLineArgs.password,
        secure: commandLineArgs.secure,
    };
}

function pick(keys, obj) {
    return Object.keys(obj).reduce((acc, key) => {
        if (keys.some((k) => k === key)) acc[key] = obj[key];
        return acc;
    }, {});
}

function getPostgratorConfigFromConfigFile(config) {
    return pick([
        'driver',
        'database',
        'migrationPattern',
        'schemaTable',
        'validateChecksum',
    ], config);
}

function getClientConfigFromConfigFile(config) {
    return pick([
        'host',
        'port',
        'database',
        'username',
        'password',
        'secure',
    ], config);
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

function checkMigrations(migrations, migrationPattern) {
    if (!migrations || !migrations.length) {
        throw new Error(`No migration files found from "${migrationPattern}"`);
    }
}

function migrate(postgrator, to, migrationPattern) {
    let toVersion;

    return postgrator.getMigrations()
        .then((migrations) => {
            checkMigrations(migrations, migrationPattern);
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
    let clientConfig = getClientConfigFromCommandLineArgs(commandLineArgs);
    if (!commandLineArgs['no-config']) {
        const explorer = cosmiconfig('postgrator');
        const result = await explorer.search();
        postgratorConfig = (!result || result.isEmpty) ? postgratorConfig : getPostgratorConfigFromConfigFile(result.config);
        clientConfig = (!result || result.isEmpty) ? clientConfig : getClientConfigFromConfigFile(result.config);
    }

    if (!postgratorConfig.migrationPattern) {
        postgratorConfig.migrationPattern = DEFAULT_MIGRATION_PATTERN;
    }
    postgratorConfig.migrationPattern = getAbsolutePath(postgratorConfig.migrationPattern);

    const migrateTo = getMigrateToNumber(commandLineArgs.to);

    clientConfig.password = await getPassword(clientConfig);

    // eslint-disable-next-line import/extensions
    const client = await getClient(postgratorConfig.driver, clientConfig);
    await client.connect();

    // Create postgrator
    let postgrator;
    try {
        postgrator = new Postgrator({
            ...postgratorConfig,
            execQuery: client.query,
        });
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

    return migrate(postgrator, migrateTo, postgratorConfig.migrationPattern)
        .then(tap(() => client.end()))
        .catch((err) => Promise.reject(err && typeof err === 'string' ? new Error(err) : err));
}

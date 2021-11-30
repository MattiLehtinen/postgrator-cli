import { readFileSync } from 'fs';
import path from 'path';
import getUsage from 'command-line-usage';
import Postgrator from 'postgrator';
import { cosmiconfig } from 'cosmiconfig';
import tap from 'p-tap';
import getClient from './clients/index.js'; // eslint-disable-line import/extensions
import {
    COMMAND_MIGRATE, COMMAND_DROP_SCHEMA, parse, sections,
} from './command-line-options.js'; // eslint-disable-line import/extensions

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

const getDefaults = (loadPath) => {
    const explorer = cosmiconfig('postgrator');
    const pResult = loadPath
        ? explorer
            .load(loadPath)
            .catch(
                (err) => (err.code === 'ENOENT' ? Promise.reject(new Error(`Config file not found: ${loadPath}`)) : Promise.reject(err)),
            )
        : explorer.search();
    return pResult.then((res) => (res && res.config) || {});
};

const getPostgratorOptions = (options) => ({
    ...(options.to ? { to: getMigrateToNumber(options.to) } : {}),
    ...(options.driver ? { driver: options.driver } : {}),
    ...(options.database ? { database: options.database } : {}),
    ...(options['migration-pattern'] ? { migrationPattern: getAbsolutePath(options['migration-pattern']) } : {}),
    ...(options['schema-table'] ? { schemaTable: options['schema-table'] } : {}),
    ...(options['validate-checksum'] ? { validateChecksum: options['validate-checksum'] } : {}),
});

const getClientOptions = async (options) => ({
    ...(options.host ? { host: options.host } : {}),
    ...(options.port ? { port: options.port } : {}),
    ...(options.database ? { database: options.database } : {}),
    ...(options.username ? { username: options.username } : {}),
    ...(options.ssl ? { ssl: options.ssl } : {}),
    ...(
        options.password // eslint-disable-line no-nested-ternary
            ? { password: options.password }
            : options.password === null
                ? { password: await promptPassword() }
                : {}
    ),
});

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
 * @returns {string} Promise<password>
 */
async function promptPassword() {
    // Ask password if it is not set
    const { default: readline } = await import('readline');

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
export async function run(argv) {
    const {
        help, version, config, 'no-config': noConfig,
    } = parse(argv); // first parse, without defaults

    // Print help if requested
    if (help) {
        printUsage();
        return Promise.resolve();
    }

    // Print version if requested
    if (version) {
        console.log(`Version: ${pjson.version}`);
        return Promise.resolve();
    }

    const defaults = noConfig ? {} : await getDefaults(config);
    const options = parse(argv, defaults);

    const postgratorOptions = getPostgratorOptions(options);

    // eslint-disable-next-line import/extensions
    const client = await getClient(postgratorOptions.driver, await getClientOptions(options));
    await client.connect();

    let postgrator;
    try {
        postgrator = new Postgrator({
            ...postgratorOptions,
            execQuery: client.query,
        });
    } catch (err) {
        printUsage();
        return Promise.reject(err);
    }

    if (options.command === COMMAND_MIGRATE) {
        // Postgrator events
        postgrator.on(
            'validation-started',
            (migration) => logMessage(`verifying checksum of migration ${migration.filename}`),
        );
        postgrator.on(
            'migration-started',
            (migration) => logMessage(`running ${migration.filename}`),
        );

        return migrate(postgrator, postgratorOptions.to, postgratorOptions.migrationPattern)
            .then(tap(() => client.end()))
            .catch((err) => Promise.reject(err && typeof err === 'string' ? new Error(err) : err));
    } if (options.command === COMMAND_DROP_SCHEMA) {
        const schemaTable = postgrator.commonClient.quotedSchemaTable();
        return postgrator
            .runQuery(`DROP TABLE ${schemaTable}`)
            .then(tap(() => client.end()))
            .then(() => undefined)
            .catch((err) => Promise.reject(err && typeof err === 'string' ? new Error(err) : err));
    }

    return Promise.reject(new Error('Invalid command'));
}

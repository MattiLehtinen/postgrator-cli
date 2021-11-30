import { expect, use } from 'chai';
import path from 'path';
import readline from 'readline';
import eachSeries from 'p-each-series';
import { pEvent as fromEvent } from 'p-event';
import { dirname } from 'dirname-filename-esm';
import { createRequire } from 'module';

import { mockCwd } from 'mock-cwd';

import getClient from '../lib/clients/index.js'; // eslint-disable-line import/extensions
import parse from '../lib/command-line-options.js'; // eslint-disable-line import/extensions
import { run } from '../lib/postgrator-cli.js'; // eslint-disable-line import/extensions

const __dirname = dirname(import.meta); // eslint-disable-line no-underscore-dangle
const require = createRequire(import.meta.url);

use(require('chai-subset'));
use(require('chai-as-promised'));
use(require('dirty-chai'));

const MAX_REVISION = 5;
const originalConsoleLog = console.log;

const tests = [];

let log = '';

function consoleLogCapture(...args) {
    log += [].slice.call(args);
}

async function removeVersionTable(options) {
    const config = {
        migrationPattern: options['migration-pattern'],
        driver: options.driver,
        host: options.host,
        port: options.port,
        database: options.database,
        username: options.username,
        password: options.password,
    };
    console.log(`\n----- ${config.driver} removing tables -----`);
    const { default: Postgrator } = await import('postgrator');
    const client = await getClient(config.driver, config);
    await client.connect();
    const pg = new Postgrator({
        ...config,
        execQuery: client.query,
    });

    await pg.runQuery('DROP TABLE IF EXISTS schemaversion, animal, person');
    return client.end();
}

function getDefaultOptions() {
    return parse();
}

/* Build a set of tests for a given config.
   This will be helpful when we want to run the same kinds of tests on
   postgres, mysql, sql server, etc.
============================================================================= */
function buildTestsForOptions(options) {
    function getArgList(opts) {
        return Object.entries(opts)
            .map(([key, val]) => [`--${key}`].concat(typeof val === 'boolean' || val === null ? [] : [val]))
            .flat();
    }

    function resetMigrations(opts = options) {
        console.log('\n----- Reset migrations-----');
        return run(getArgList({ ...opts, to: 0 }));
    }

    tests.push(() => removeVersionTable(options));

    tests.push(async () => {
        console.log('\n----- testing show help (output suppressed)-----');
        const args = getArgList({
            ...options,
            help: true,
        });

        console.log = consoleLogCapture;
        await expect(run(args)).to.become(undefined);
        console.log = originalConsoleLog;
        expect(log).to.match(/Examples/, 'No help was displayed');
    });

    tests.push(async () => {
        console.log('\n----- testing show version (output suppressed)-----');
        const args = getArgList({
            ...options,
            version: true,
        });

        console.log = consoleLogCapture;
        await expect(run(args)).to.become(undefined);
        console.log = originalConsoleLog;
        expect(log).to.match(/Version: /, 'No version was displayed');
    });

    tests.push(async () => {
        console.log('\n----- testing migration to 003 -----');
        return expect(run(getArgList(options)))
            .to.eventually.have.lengthOf(3)
            .and.have.nested.property('2.version').equal(3);
    });

    tests.push(async () => {
        console.log('\n----- testing migration to 000 with conflict detection-----');
        const args = getArgList({
            ...options,
            to: 0,
        });

        await expect(run(args)).to.eventually.have.lengthOf(3).and.containSubset({
            2: {
                version: 1,
                action: 'undo',
            },
        });
    });

    tests.push(async () => {
        console.log('\n----- testing migration to 001 -----');
        const args = getArgList({
            ...options,
            to: 1,
        });

        await expect(run(args)).to.eventually.have.lengthOf(1).and.containSubset({
            0: {
                version: 1,
                action: 'do',
            },
        });
    });

    tests.push(async () => {
        console.log('\n----- testing migration from 001 to 003 using config file defined explicitly -----');
        const args = getArgList({
            to: '0003',
            config: 'test/sample-config.json',
        });

        const migrations = await run(args);
        expect(migrations[migrations.length - 1].version).to.equal(3);
    });

    tests.push(() => {
        console.log('\n----- testing migration from 003 to 002 using config file -----');
        const args = getArgList({
            to: '02',
        });

        return mockCwd(path.join(__dirname, 'sample-config'), async () => {
            await expect(run(args)).to.eventually.containSubset({
                0: {
                    version: 3,
                    action: 'undo',
                },
            });
        });
    });

    tests.push(async () => {
        console.log('\n----- testing non-existing config file-----');
        const args = getArgList({
            to: '003',
            config: 'test/config-which-does-not-exist.json',
        });

        await expect(run(args)).to.be.rejectedWith(Error, /^Config file not found:/);
    });

    tests.push(resetMigrations);

    tests.push(() => {
        console.log('\n----- testing merging cli and config options -----');
        const args = getArgList({
            to: '003',
            password: options.password,
            config: 'test/config-without-password.json',
        });

        return expect(run(args)).to.eventually.have.lengthOf(3);
    });

    tests.push(resetMigrations);

    tests.push(async () => {
        console.log('\n----- testing using latest revision without specifying to-----');
        const args = getArgList({
            ...options,
            to: getDefaultOptions().to, // is 'max',
        });

        await expect(run(args)).to.eventually.have.lengthOf(MAX_REVISION).and.containSubset({
            [MAX_REVISION - 1]: {
                version: MAX_REVISION,
            },
        });
    });

    tests.push(resetMigrations);

    tests.push(() => {
        console.log('\n----- testing using latest revision with config file set by absolute path-----');
        const args = getArgList({
            config: path.resolve(__dirname, './sample-config.json'),
        });

        return expect(run(args)).to.eventually.have.lengthOf(MAX_REVISION);
    });

    tests.push(() => {
        console.log('\n----- testing it does not re-apply same migrations -----');

        return mockCwd(path.join(__dirname, 'sample-config'), async () => {
            await expect(run()).to.eventually.have.lengthOf(0);
        });
    });

    tests.push(resetMigrations);

    tests.push(() => {
        console.log('\n----- testing preferring cli arguments over config options-----');
        const args = getArgList({
            username: 'invaliduser',
            config: path.resolve(__dirname, './sample-config.json'),
        });

        return expect(run(args)).to.be.rejectedWith(Error, /^password authentication failed for user "invaliduser"/);
    });

    tests.push(resetMigrations);

    tests.push(async () => {
        console.log('\n----- testing using environment variables to run migrations -----');
        process.env.PGHOST = options.host;
        process.env.PGPORT = options.port;
        process.env.PGUSER = options.username;
        process.env.PGPASSWORD = options.password;
        process.env.PGDATABASE = options.database;

        await expect(run(['--migration-pattern', options['migration-pattern']])).to.eventually.have.lengthOf(MAX_REVISION);
        process.env.PGHOST = undefined;
        process.env.PGPORT = undefined;
        process.env.PGUSER = undefined;
        process.env.PGPASSWORD = undefined;
        process.env.PGDATABASE = undefined;
    });

    tests.push(async () => {
        console.log('\n----- testing with no migration files found-----');
        const args = getArgList({
            ...options,
            to: 3,
            'migration-pattern': 'test/empty-migrations/*',
        });

        console.log = consoleLogCapture;
        await expect(run(args)).to.be.rejectedWith(Error, /^No migration files found/);
        console.log = originalConsoleLog;
        expect(log).not.to.match(/Examples/, "Help was displayed when shouldn't");
    });

    tests.push(resetMigrations);

    tests.push(() => {
        console.log('\n----- testing ignoring config file -----');
        const args = getArgList({
            ...options,
            'migration-pattern': '../migrations/*',
            'no-config': true,
            to: 'max',
        });

        return mockCwd(path.join(__dirname, 'config-with-non-existing-directory'), async () => {
            await expect(run(args)).to.eventually.have.lengthOf(MAX_REVISION).and.containSubset({
                [MAX_REVISION - 1]: {
                    version: MAX_REVISION,
                },
            });
        });
    });

    tests.push(resetMigrations);

    tests.push(() => {
        console.log('\n----- testing with alternative migration directory set in config file-----');
        const args = getArgList({
            to: 'max',
        });

        return mockCwd(path.join(__dirname, 'config-with-other-directory'), async () => {
            await expect(run(args)).to.eventually.have.lengthOf(2);
            await resetMigrations({});
        });
    });

    tests.push(async () => {
        console.log('\n----- testing empty password-----');
        const args = getArgList({
            ...options,
            password: '',
        });

        run(args);
        // this error is not thrown down the chain so it cannot be caught
        await expect(fromEvent(process, 'unhandledRejection'))
            .to.eventually.be.an('error')
            .and.have.property('message')
            .match(/password authentication failed for user/);
    });

    tests.push(async () => {
        console.log('\n----- testing null password asks from user when password option is empty -----');

        let passwordAsked = false;
        const args = getArgList({
            ...options,
            password: null,
        });

        // mock readline
        const originalCreateInterface = readline.createInterface;
        readline.createInterface = () => {
            return {
                question: (_questionTest, cb) => { passwordAsked = true; cb('myPassword'); }, // invalid password
                history: { slice: () => {} },
                close: () => {},
            };
        };

        await expect(run(args)).to.be.rejectedWith(Error, /password authentication failed/);
        expect(passwordAsked).to.be.true();
        readline.createInterface = originalCreateInterface;
    });

    tests.push(async () => {
        console.log('\n----- testing that config file without password asks from user when password option is empty -----');
        const args = getArgList({
            to: 'max',
            config: 'test/config-without-password.json',
            password: null,
        });
        let passwordAsked = false;

        // mock readline
        const originalCreateInterface = readline.createInterface;
        readline.createInterface = () => {
            return {
                question: (_questionTest, cb) => { passwordAsked = true; cb('postgrator'); }, // correct password
                history: { slice: () => {} },
                close: () => {},
            };
        };

        await expect(run(args)).to.eventually.have.property('length').greaterThan(0);
        expect(passwordAsked).to.be.true();
        await resetMigrations({ config: 'test/config-without-password.json', password: null });
        readline.createInterface = originalCreateInterface;
    });

    tests.push(() => {
        console.log('\n----- testing detecting migration files with same number-----');
        const args = getArgList({
            ...options,
            to: 3,
            'migration-pattern': 'test/conflicting-migrations/*',
        });

        return expect(run(args))
            .to.be.rejectedWith(Error, /^Two migrations found with version 2 and action do/, 'No migration conflicts were detected');
    });

    tests.push(async () => {
        console.log('\n----- testing using migration number at the end -----');

        const migrations = await run(['--config', 'test/sample-config.json', '0003']);
        expect(migrations[migrations.length - 1].version).to.equal(3);
    });

    tests.push(resetMigrations);

    tests.push(() => removeVersionTable({
        ...options,
        driver: 'mysql',
        port: 3306,
    }));

    tests.push(async () => {
        console.log('\n----- testing migration to 003 using mysql -----');
        const args = ['3', '--config', 'test/mysql-config.json'];

        return expect(run(args)).to.eventually.have.lengthOf(3).and.have.nested.property('2.version').equal(3);
    });

    tests.push(() => removeVersionTable({
        ...options,
        driver: 'mssql',
        port: 1433,
        database: 'master',
        username: 'sa',
        password: 'Postgrator123!',
    }));

    tests.push(async () => {
        console.log('\n----- testing migration to 003 using mssql -----');
        const args = ['3', '--config', 'test/mssql-config.json'];

        return expect(run(args)).to.eventually.have.lengthOf(3).and.have.nested.property('2.version').equal(3);
    });

    tests.push(async () => {
        console.log('\n----- testing dropping schema table-----');
        const args = getArgList({
            config: 'test/sample-config.json',
            to: 0,
        });

        await expect(run(args)).to.eventually.have.lengthOf(0);
        return expect(run(['drop-schema', '--config', 'test/sample-config.json']))
            .to.become(undefined);
    });

    tests.push(async () => {
        console.log('\n----- testing dropping schema table with default configuration file -----');

        return mockCwd(path.join(__dirname, 'sample-config'), async () => {
            await expect(run(['0'])).to.eventually.have.lengthOf(0);
            await expect(run(['drop-schema'])).to.become(undefined);
        });
    });

    tests.push(async () => {
        console.log('\n----- testing dropping schema when the table name is specified explicitly -----');
        const args = getArgList({
            'schema-table': 'my-schema-table',
            config: 'test/sample-config.json',
            to: 0,
        });

        await expect(run(args)).to.eventually.have.lengthOf(0);
        return expect(run(['drop-schema', '--config', 'test/sample-config.json', '--schema-table', 'my-schema-table']))
            .to.become(undefined);
    });

    tests.push(() => {
        console.log('\n----- testing dropping schema table that does not exist -----');
        return expect(run(['drop-schema', '--config', 'test/sample-config.json']))
            .to.be.rejectedWith(Error, 'table "schemaversion" does not exist');
    });
}

const options = {
    to: 3,
    driver: 'pg',
    host: '127.0.0.1',
    port: '5432',
    database: 'postgrator',
    username: 'postgrator',
    password: 'postgrator',
    'migration-pattern': 'test/migrations/*',
    'schema-table': 'schemaversion',
    'validate-checksum': true,
};

// Command line parameters
buildTestsForOptions(options);

// Run the tests
console.log(`Running ${tests.length} tests`);
eachSeries(tests, (testFunc) => {
    console.log = originalConsoleLog;
    log = '';
    return testFunc();
}).then(() => {
    console.log('\nIt works!');
    process.exit(0);
}).catch((err) => {
    console.log = originalConsoleLog;
    console.log(err);
});

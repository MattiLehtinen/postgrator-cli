import { expect, use } from 'chai';
import path from 'path';
import readline from 'readline';
import eachSeries from 'p-each-series';
import { pEvent as fromEvent } from 'p-event';
import { dirname } from 'dirname-filename-esm';
import { createRequire } from 'module';

import { mockCwd } from 'mock-cwd';

import getClient from '../lib/clients/index.js'; // eslint-disable-line import/extensions
import { parse } from '../lib/command-line-options.js'; // eslint-disable-line import/extensions
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
    return parse({ partial: true });
}

/* Build a set of tests for a given config.
   This will be helpful when we want to run the same kinds of tests on
   postgres, mysql, sql server, etc.
============================================================================= */
function buildTestsForOptions(options) {
    const originalOptions = JSON.parse(JSON.stringify(options));

    function restoreOptions() {
        options = JSON.parse(JSON.stringify(originalOptions));
    }

    async function resetMigrations() {
        console.log('\n----- Reset migrations-----');
        const originalTo = options.to;
        options.to = 0;
        await run(options);
        options.to = originalTo;
    }

    tests.push(() => removeVersionTable(options));

    tests.push(async () => {
        console.log('\n----- testing show help (output suppressed)-----');
        options.help = true;

        console.log = consoleLogCapture;
        await expect(run(options)).to.become(undefined);
        console.log = originalConsoleLog;
        restoreOptions();
        expect(log).to.match(/Examples/, 'No help was displayed');
    });

    tests.push(async () => {
        console.log('\n----- testing show version (output suppressed)-----');
        options.version = true;

        console.log = consoleLogCapture;
        await expect(run(options)).to.become(undefined);
        console.log = originalConsoleLog;
        restoreOptions();
        expect(log).to.match(/Version: /, 'No version was displayed');
    });

    tests.push(async () => {
        console.log('\n----- testing migration to 003 -----');
        return expect(run(options))
            .to.eventually.have.lengthOf(3)
            .and.have.nested.property('2.version').equal(3);
    });

    tests.push(async () => {
        console.log('\n----- testing migration to 000 with conflict detection-----');
        options.to = 0;

        await expect(run(options)).to.eventually.have.lengthOf(3).and.containSubset({
            2: {
                version: 1,
                action: 'undo',
            },
        });
        restoreOptions();
    });

    tests.push(async () => {
        console.log('\n----- testing migration to 001 -----');
        options.to = 1;
        await expect(run(options)).to.eventually.have.lengthOf(1).and.containSubset({
            0: {
                version: 1,
                action: 'do',
            },
        });
        restoreOptions();
    });

    tests.push(async () => {
        console.log('\n----- testing migration from 001 to 003 using config file defined explicitly -----');
        options.to = '0003';
        options.username = '';
        options.database = '';
        options.config = 'test/sample-config.json';

        const migrations = await run(options);
        expect(migrations[migrations.length - 1].version).to.equal(3);
        restoreOptions();
    });

    tests.push(() => {
        console.log('\n----- testing migration from 003 to 002 using config file -----');
        options.to = '02';
        options.username = '';
        options.database = '';

        return mockCwd(path.join(__dirname, 'sample-config'), async () => {
            await expect(run(options)).to.eventually.containSubset({
                0: {
                    version: 3,
                    action: 'undo',
                },
            });
            restoreOptions();
        });
    });

    tests.push(async () => {
        console.log('\n----- testing non-existing config file-----');
        options.config = 'test/config-which-does-not-exist.json';
        options.to = '003';

        await expect(run(options)).to.be.rejectedWith(Error, /^Config file not found:/);
        restoreOptions();
    });

    tests.push(resetMigrations);

    tests.push(async () => {
        console.log('\n----- testing using latest revision without specifying to-----');
        options.to = getDefaultOptions().to; // is 'max'

        await expect(run(options)).to.eventually.have.lengthOf(MAX_REVISION).and.containSubset({
            [MAX_REVISION - 1]: {
                version: MAX_REVISION,
            },
        });
        restoreOptions();
    });

    tests.push(resetMigrations);

    tests.push(async () => {
        console.log('\n----- testing using latest revision with config file set by absolute path-----');
        const absolutePath = path.resolve(__dirname, './sample-config.json');
        options.config = absolutePath;
        options.password = '';
        options.to = '';

        await expect(run(options)).to.eventually.have.lengthOf(MAX_REVISION);
        restoreOptions();
    });

    tests.push(() => {
        console.log('\n----- testing it does not re-apply same migrations -----');
        options.password = '';
        options.to = '';

        return mockCwd(path.join(__dirname, 'sample-config'), async () => {
            await expect(run(options)).to.eventually.have.lengthOf(0);
            restoreOptions();
        });
    });

    tests.push(async () => {
        console.log('\n----- testing with no migration files found-----');
        options.to = 3;
        options['migration-pattern'] = 'test/empty-migrations/*';

        console.log = consoleLogCapture;
        await expect(run(options)).to.be.rejectedWith(Error, /^No migration files found/);
        console.log = originalConsoleLog;
        expect(log).not.to.match(/Examples/, "Help was displayed when shouldn't");
        restoreOptions();
    });

    tests.push(resetMigrations);

    tests.push(() => {
        console.log('\n----- testing ignoring config file -----');
        options['migration-pattern'] = '../migrations/*';
        options['no-config'] = true;
        options.to = 'max';

        return mockCwd(path.join(__dirname, 'config-with-non-existing-directory'), async () => {
            await expect(run(options)).to.eventually.have.lengthOf(MAX_REVISION).and.containSubset({
                [MAX_REVISION - 1]: {
                    version: MAX_REVISION,
                },
            });
            restoreOptions();
        });
    });

    tests.push(resetMigrations);

    tests.push(() => {
        console.log('\n----- testing with alternative migration directory set in config file-----');
        options.to = 'max';
        options.username = '';
        options.database = '';

        return mockCwd(path.join(__dirname, 'config-with-other-directory'), async () => {
            await expect(run(options)).to.eventually.have.lengthOf(2);
            await resetMigrations();
            restoreOptions();
        });
    });

    tests.push(async () => {
        console.log('\n----- testing empty password-----');
        options.password = '';

        run(options);
        // this error is not thrown down the chain so it cannot be caught
        await expect(fromEvent(process, 'unhandledRejection'))
            .to.eventually.be.an('error')
            .and.have.property('message')
            .match(/password authentication failed for user/);
        restoreOptions();
    });

    tests.push(async () => {
        console.log('\n----- testing null password asks from user-----');

        let passwordAsked = false;
        options.password = null;

        // mock readline
        const originalCreateInterface = readline.createInterface;
        readline.createInterface = () => {
            return {
                question: (_questionTest, cb) => { passwordAsked = true; cb('myPassword'); }, // invalid password
                history: { slice: () => {} },
                close: () => {},
            };
        };

        await expect(run(options)).to.be.rejectedWith(Error, /password authentication failed/);
        expect(passwordAsked).to.be.true();
        restoreOptions();
        readline.createInterface = originalCreateInterface;
    });

    tests.push(() => {
        console.log('\n----- testing that config file without password asks from user -----');
        options.to = 'max';
        options.username = '';
        options.database = '';
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

        return mockCwd(path.join(__dirname, 'config-without-password'), async () => {
            await expect(run(options)).to.eventually.have.property('length').greaterThan(0);
            expect(passwordAsked).to.be.true();
            await resetMigrations();
            readline.createInterface = originalCreateInterface;
            restoreOptions();
        });
    });

    tests.push(async () => {
        console.log('\n----- testing detecting migration files with same number-----');
        options.to = 3;
        options['migration-pattern'] = 'test/conflicting-migrations/*';

        await expect(run(options))
            .to.be.rejectedWith(Error, /^Two migrations found with version 2 and action do/, 'No migration conflicts were detected');
        restoreOptions();
    });

    tests.push(() => removeVersionTable({
        ...options,
        driver: 'mysql',
        port: 3306,
    }));

    tests.push(async () => {
        console.log('\n----- testing migration to 003 using mysql -----');

        return mockCwd(
            path.join(__dirname, 'mysql-config'),
            async () => expect(run(options)).to.eventually.have.lengthOf(3).and.have.nested.property('2.version').equal(3),
        );
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

        return mockCwd(
            path.join(__dirname, 'mssql-config'),
            async () => expect(run(options)).to.eventually.have.lengthOf(3).and.have.nested.property('2.version').equal(3),
        );
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

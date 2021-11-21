const assert = require('assert');
const commandLineArgs = require('command-line-args');
const path = require('path');
const readline = require('readline');
const eachSeries = require('p-each-series');
const fromEvent = require('p-event');
const { mockCwd } = require('mock-cwd');

const commandLineOptions = require('../command-line-options');
const postgratorCli = require('../postgrator-cli');

const MAX_REVISION = 5;
const optionList = commandLineOptions.optionList; // eslint-disable-line prefer-destructuring
const originalConsoleLog = console.log;

const tests = [];

let log = '';

function consoleLogCapture(...args) {
    log += [].slice.call(args);
}

function removeVersionTable(options) {
    const config = {
        migrationDirectory: options['migration-directory'],
        driver: options.driver,
        host: options.host,
        port: options.port,
        database: options.database,
        username: options.username,
        password: options.password,
    };
    console.log(`\n----- ${config.driver} removing tables -----`);
    const Postgrator = require('postgrator');
    const pg = new Postgrator(config);

    return pg.runQuery('DROP TABLE IF EXISTS schemaversion, animal, person').catch((err) => {
        assert.ifError(err);
        return Promise.reject(err);
    });
}

function getDefaultOptions() {
    return commandLineArgs(optionList, { partial: true });
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
        await postgratorCli.run(options);
        options.to = originalTo;
    }

    tests.push(() => removeVersionTable(options).catch((err) => {
        assert.ifError(err);
        return Promise.resolve();
    }));

    tests.push(async () => {
        console.log('\n----- testing show help (output suppressed)-----');
        options.help = true;

        console.log = consoleLogCapture;
        const migrations = await postgratorCli.run(options);
        console.log = originalConsoleLog;
        restoreOptions();
        assert.strictEqual(migrations, undefined);
        assert.ok(log.indexOf('Examples') >= 0, 'No help was displayed');
    });

    tests.push(async () => {
        console.log('\n----- testing show version (output suppressed)-----');
        options.version = true;

        console.log = consoleLogCapture;
        const migrations = await postgratorCli.run(options);
        console.log = originalConsoleLog;
        restoreOptions();
        assert.strictEqual(migrations, undefined);
        assert.ok(log.indexOf('Version: ') >= 0, 'No version was displayed');
    });

    tests.push(async () => {
        console.log('\n----- testing migration to 003 -----');
        const migrations = await postgratorCli.run(options);
        assert.equal(migrations.length, 3);
        assert.equal(migrations[2].version, 3);
    });

    tests.push(async () => {
        console.log('\n----- testing migration to 000 with conflict detection-----');
        options.to = 0;

        const migrations = await postgratorCli.run(options);
        restoreOptions();
        assert.equal(migrations.length, 3);
        assert.equal(migrations[2].version, 1);
        assert.equal(migrations[2].action, 'undo');
    });

    tests.push(async () => {
        console.log('\n----- testing migration to 001 -----');
        options.to = 1;
        const migrations = await postgratorCli.run(options);
        restoreOptions();
        assert.equal(migrations.length, 1);
        assert.equal(migrations[0].version, 1);
        assert.equal(migrations[0].action, 'do');
    });

    tests.push(() => {
        console.log('\n----- testing migration from 001 to 003 using config file -----');
        options.to = '0003';
        options.username = '';
        options.database = '';

        return mockCwd(path.join(__dirname, 'sample-config'), async () => {
            const migrations = await postgratorCli.run(options);
            restoreOptions();
            assert.equal(migrations[migrations.length - 1].version, 3);
        });
    });

    tests.push(() => {
        console.log('\n----- testing migration from 003 to 002 using config file -----');
        options.to = '02';
        options.username = '';
        options.database = '';

        return mockCwd(path.join(__dirname, 'sample-config'), async () => {
            const migrations = await postgratorCli.run(options);
            restoreOptions();
            assert.equal(migrations[0].version, 3);
            assert.equal(migrations[0].action, 'undo');
        });
    });

    tests.push(resetMigrations);

    tests.push(async () => {
        console.log('\n----- testing using latest revision without specifying to-----');
        options.to = getDefaultOptions().to; // is 'max'

        const migrations = await postgratorCli.run(options);
        restoreOptions();
        assert.equal(migrations.length, MAX_REVISION);
        assert.equal(migrations[migrations.length - 1].version, MAX_REVISION);
    });

    tests.push(() => {
        console.log('\n----- testing it does not re-apply same migrations -----');
        options.password = '';
        options.to = '';

        return mockCwd(path.join(__dirname, 'sample-config'), async () => {
            const migrations = await postgratorCli.run(options);
            restoreOptions();
            assert.equal(migrations.length, 0); // returns number of applied migrations
        });
    });

    tests.push(async () => {
        console.log('\n----- testing with no migration files found-----');
        options.to = 3;
        options['migration-directory'] = 'test/empty-migrations';

        console.log = consoleLogCapture;
        try {
            await postgratorCli.run(options);
        } catch (err) {
            console.log = originalConsoleLog;
            restoreOptions();
            assert(err, 'No error when there should be');
            assert(err.message.indexOf('No migration files found') >= 0);
            assert(log.indexOf('Examples') < 0, "Help was displayed when shouldn't");
        }
    });

    tests.push(async () => {
        console.log('\n----- testing with non-existing migration directory set-----');
        options.to = 3;
        options['migration-directory'] = 'test/non-existing-directory';

        console.log = consoleLogCapture;
        try {
            await postgratorCli.run(options);
        } catch (err) {
            console.log = originalConsoleLog;
            restoreOptions();
            assert(err.message.indexOf('does not exist') >= 0);
            assert(log.indexOf('Examples') < 0, "Help was displayed when shouldn't");
        }
    });

    tests.push(() => {
        console.log('\n----- testing with non-existing migration directory set in config file-----');
        options.username = '';
        options.database = '';

        console.log = consoleLogCapture;
        return mockCwd(path.join(__dirname, 'config-with-non-existing-directory'), async () => {
            try {
                await postgratorCli.run(options);
            } catch (err) {
                console.log = originalConsoleLog;
                restoreOptions();
                assert(err.message.indexOf('non-existing-migrations-directory') >= 0);
                assert(err.message.indexOf('does not exist') >= 0);
                assert(log.indexOf('Examples') < 0, "Help was displayed when shouldn't");
            }
        });
    });

    tests.push(resetMigrations);

    tests.push(() => {
        console.log('\n----- testing ignoring config file -----');
        options['migration-directory'] = '../migrations';
        options['no-config'] = true;
        options.to = 'max';

        return mockCwd(path.join(__dirname, 'config-with-non-existing-directory'), async () => {
            const migrations = await postgratorCli.run(options);
            restoreOptions();
            assert.equal(migrations.length, MAX_REVISION);
            assert.equal(migrations[migrations.length - 1].version, MAX_REVISION);
        });
    });

    tests.push(resetMigrations);

    tests.push(() => {
        console.log('\n----- testing with alternative migration directory set in config file-----');
        options.to = 'max';
        options.username = '';
        options.database = '';

        return mockCwd(path.join(__dirname, 'config-with-other-directory'), async () => {
            const migrations = await postgratorCli.run(options);
            assert(migrations.length, 2);
            await resetMigrations();
            restoreOptions();
        });
    });

    tests.push(async () => {
        console.log('\n----- testing empty password-----');
        options.password = '';

        postgratorCli.run(options);
        // this error is not thrown down the chain so it cannot be caught
        const err = await fromEvent(process, 'uncaughtException');
        assert(err, 'ERR_INVALID_ARG_TYPE');
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

        return postgratorCli.run(options).catch((err) => {
            restoreOptions();
            assert(passwordAsked);
            assert(err.length > 0);
            readline.createInterface = originalCreateInterface;
        });
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
            const migrations = await postgratorCli.run(options);
            assert(migrations.length);
            assert(passwordAsked);
            await resetMigrations();
            readline.createInterface = originalCreateInterface;
            restoreOptions();
        });
    });

    tests.push(() => {
        console.log('\n----- testing showing help and error without any cmd params if no migrations directory-----');
        const defaultOptions = getDefaultOptions();

        console.log = consoleLogCapture;
        return postgratorCli.run(defaultOptions).catch((err) => {
            console.log = originalConsoleLog;
            restoreOptions();
            assert.ok(log.indexOf('Examples') >= 0, 'No help was displayed');
            assert(err.message.indexOf('does not exist') >= 0, 'No directory does not exist error was displayed');
        });
    });

    tests.push(() => {
        console.log('\n----- testing detecting migration files with same number-----');
        options.to = 3;
        options['migration-directory'] = 'test/conflicting-migrations';

        return postgratorCli.run(options).catch((err) => {
            restoreOptions();
            assert(err.message.indexOf('Two migrations found with version 2 and action do') >= 0, 'No migration conflicts were detected');
        });
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
    'migration-directory': 'test/migrations',
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
    assert.ifError(err);
});

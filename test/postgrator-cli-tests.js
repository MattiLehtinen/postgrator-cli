const assert = require('assert');
const async = require('async');
const commandLineArgs = require('command-line-args');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const commandLineOptions = require('../command-line-options');
const postgratorCli = require('../postgrator-cli');

const defaultConfigFileName = 'postgrator.json';
const optionList = commandLineOptions.optionList; // eslint-disable-line prefer-destructuring
const originalConsoleLog = console.log;

const tests = [];

let log = '';

function consoleLogCapture(...args) {
    log += [].slice.call(args);
}

function promiseToCallback(promise, callback) {
    promise.then((data) => {
        process.nextTick(callback, null, data);
    }, (err) => {
        process.nextTick(callback, err);
    });
}

function removeVersionTable(options, callback) {
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
    const Postgrator = require('../node_modules/postgrator/postgrator.js');
    const pg = new Postgrator(config);

    promiseToCallback(pg.runQuery('DROP TABLE IF EXISTS schemaversion, animal, person'), (err) => {
        assert.ifError(err);
        callback(err);
    });
}

function copyConfigToFile(file) {
    fs.writeFileSync(file, fs.readFileSync('test/sample-config.json'));
}

function deleteConfigFile(file) {
    fs.unlinkSync(file);
}

function copyConfigToDefaultFile() {
    copyConfigToFile(defaultConfigFileName);
}

function deleteDefaultConfigFile() {
    deleteConfigFile(defaultConfigFileName);
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

    function resetMigrations(callback) {
        console.log('\n----- Reset migrations-----');
        const originalTo = options.to;
        options.to = 0;
        postgratorCli.run(options, (err) => {
            assert.ifError(err);
            options.to = originalTo;
            return callback();
        });
    }

    tests.push((callback) => {
        removeVersionTable(options, (err) => {
            assert.ifError(err);
            return callback();
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing show help (output suppressed)-----');
        options.help = true;

        console.log = consoleLogCapture;
        postgratorCli.run(options, (err, migrations) => {
            console.log = originalConsoleLog;
            restoreOptions();
            assert.strictEqual(migrations, undefined);
            assert.ok(log.indexOf('Examples') >= 0, 'No help was displayed');
            assert.ifError(err);
            return callback();
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing show version (output suppressed)-----');
        options.version = true;

        console.log = consoleLogCapture;
        postgratorCli.run(options, (err, migrations) => {
            console.log = originalConsoleLog;
            restoreOptions();
            assert.strictEqual(migrations, undefined);
            assert.ok(log.indexOf('Version: ') >= 0, 'No version was displayed');
            assert.ifError(err);
            return callback();
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing migration to 003 -----');
        postgratorCli.run(options, (err, migrations) => {
            assert.ifError(err);
            assert.equal(migrations.length, 3);
            assert.equal(migrations[2].version, 3);
            return callback();
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing migration to 000 with conflict detection-----');
        options.to = 0;
        options['detect-version-conflicts'] = true;

        postgratorCli.run(options, (err, migrations) => {
            restoreOptions();
            assert.equal(migrations.length, 3);
            assert.equal(migrations[2].version, 1);
            assert.equal(migrations[2].action, 'undo');
            assert.ifError(err);
            return callback();
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing migration to 001 -----');
        options.to = 1;
        postgratorCli.run(options, (err, migrations) => {
            restoreOptions();
            assert.equal(migrations.length, 1);
            assert.equal(migrations[0].version, 1);
            assert.equal(migrations[0].action, 'do');
            assert.ifError(err);
            return callback();
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing migration from 001 to 003 using config file -----');
        options.to = '0003';
        options.username = '';
        options.database = '';
        options.config = 'test/sample-config.json';

        postgratorCli.run(options, (err, migrations) => {
            restoreOptions();
            assert.equal(migrations[migrations.length - 1].version, 3);
            assert.ifError(err);
            return callback();
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing migration from 003 to 002 using config file -----');
        options.to = '02';
        options.username = '';
        options.database = '';
        options.config = 'test/sample-config.json';

        postgratorCli.run(options, (err, migrations) => {
            restoreOptions();
            assert.equal(migrations[0].version, 3);
            assert.equal(migrations[0].action, 'undo');
            assert.ifError(err);
            return callback();
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing non-existing config file-----');
        options.config = 'test/config-which-does-not-exist.json';
        options.to = '003';

        postgratorCli.run(options, (err) => {
            restoreOptions();
            assert(err);
            assert(err.message.indexOf('Config file not found:') >= 0);
            return callback();
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing searching default config file (postgrator.json)-----');

        copyConfigToDefaultFile();
        options.config = '';
        options.password = '';
        options.to = '000';

        postgratorCli.run(options, (err, migrations) => {
            restoreOptions();
            deleteDefaultConfigFile();
            assert.ifError(err);
            assert(migrations.length > 0);
            return callback();
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing using latest revision without specifying to-----');
        options.to = getDefaultOptions().to; // is 'max'

        postgratorCli.run(options, (err, migrations) => {
            restoreOptions();
            assert.ifError(err);
            assert.equal(migrations.length, 4);
            assert.equal(migrations[migrations.length - 1].version, 4);
            return callback();
        });
    });

    tests.push(resetMigrations);

    tests.push((callback) => {
        console.log('\n----- testing using latest revision with default config file-----');
        copyConfigToDefaultFile();

        options.config = '';
        options.password = '';
        options.to = '';

        postgratorCli.run(options, (err, migrations) => {
            restoreOptions();
            deleteDefaultConfigFile();
            assert.ifError(err);
            assert.equal(migrations.length, 4);
            return callback();
        });
    });

    tests.push(resetMigrations);

    tests.push((callback) => {
        console.log('\n----- testing using latest revision with config file set by absolute path-----');
        const absolutePath = path.resolve(__dirname, './sample-config.json');
        options.config = absolutePath;
        options.password = '';
        options.to = '';

        postgratorCli.run(options, (err, migrations) => {
            restoreOptions();
            assert.ifError(err);
            assert.equal(migrations.length, 4);
            return callback();
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing it does not re-apply same migrations -----');
        const absolutePath = path.resolve(__dirname, './sample-config.json');
        options.config = absolutePath;
        options.password = '';
        options.to = '';

        postgratorCli.run(options, (err, migrations) => {
            restoreOptions();
            assert.ifError(err);
            assert.equal(migrations.length, 0); // returns number of applied migrations
            return callback();
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing with no migration files found-----');
        options.config = '';
        options.to = 3;
        options['migration-directory'] = 'test/empty-migrations';

        console.log = consoleLogCapture;
        postgratorCli.run(options, (err, migrations) => {
            console.log = originalConsoleLog;
            restoreOptions();
            assert(err, 'No error when there should be');
            assert(err.message.indexOf('No migration files found') >= 0);
            assert.strictEqual(migrations, undefined);
            assert(log.indexOf('Examples') < 0, "Help was displayed when shouldn't");
            return callback();
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing with non-existing migration directory set-----');
        options.config = '';
        options.to = 3;
        options['migration-directory'] = 'test/non-existing-directory';

        console.log = consoleLogCapture;
        postgratorCli.run(options, (err, migrations) => {
            console.log = originalConsoleLog;
            restoreOptions();
            assert(err.message.indexOf('does not exist') >= 0);
            assert(log.indexOf('Examples') < 0, "Help was displayed when shouldn't");
            assert.strictEqual(migrations, undefined);
            return callback();
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing with non-existing migration directory set in config file-----');
        options.username = '';
        options.database = '';
        options.config = 'test/config-with-non-existing-directory.json';

        console.log = consoleLogCapture;
        postgratorCli.run(options, (err, migrations) => {
            console.log = originalConsoleLog;
            restoreOptions();
            assert(err.message.indexOf('non-existing-migrations-directory') >= 0);
            assert(err.message.indexOf('does not exist') >= 0);
            assert(log.indexOf('Examples') < 0, "Help was displayed when shouldn't");
            assert.strictEqual(migrations, undefined);
            return callback();
        });
    });

    tests.push(resetMigrations);

    tests.push((callback) => {
        console.log('\n----- testing with alternative migration directory set in config file-----');
        options.to = 'max';
        options.username = '';
        options.database = '';
        options.config = 'test/config-with-other-directory.json';

        postgratorCli.run(options, (err, migrations) => {
            assert.ifError(err);
            assert(migrations.length, 2);
            return resetMigrations(() => {
                restoreOptions();
                callback();
            });
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing empty password-----');
        options.config = '';
        options.password = '';

        postgratorCli.run(options, (err) => {
            restoreOptions();
            assert(err.length > 0);
            return callback(null);
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing null password asks from user-----');

        let passwordAsked = false;
        options.config = '';
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

        postgratorCli.run(options, (err) => {
            restoreOptions();
            assert(passwordAsked);
            assert(err.length > 0);
            readline.createInterface = originalCreateInterface;
            return callback(null);
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing that config file without password asks from user -----');
        options.to = 'max';
        options.username = '';
        options.database = '';
        options.config = 'test/config-without-password.json';
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

        postgratorCli.run(options, (err, migrations) => {
            assert.ifError(err);
            assert(migrations.length);
            assert(passwordAsked);
            readline.createInterface = originalCreateInterface;
            return resetMigrations(() => {
                restoreOptions();
                callback();
            });
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing showing help and error without any cmd params if no migrations directory-----');
        const defaultOptions = getDefaultOptions();

        console.log = consoleLogCapture;
        postgratorCli.run(defaultOptions, (err, migrations) => {
            console.log = originalConsoleLog;
            restoreOptions();
            assert.strictEqual(migrations, undefined);
            assert.ok(log.indexOf('Examples') >= 0, 'No help was displayed');
            assert(err.message.indexOf('does not exist') >= 0, 'No directory does not exist error was displayed');
            return callback();
        });
    });

    tests.push((callback) => {
        console.log('\n----- testing detecting migration files with same number-----');
        options.config = '';
        options['detect-version-conflicts'] = true;
        options.to = 3;
        options['migration-directory'] = 'test/conflicting-migrations';

        postgratorCli.run(options, (err, migrations) => {
            restoreOptions();
            assert.strictEqual(
                migrations,
                undefined,
                'Migrations were run although there were migration files with same number'
            );
            assert(err.message.indexOf('Two migrations found with version 2 and action do') >= 0, 'No migration conflicts were detected');
            return callback();
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
async.eachSeries(tests, (testFunc, callback) => {
    console.log = originalConsoleLog;
    log = '';
    testFunc(callback);
}, (err) => {
    if (err) {
        console.log = originalConsoleLog;
        console.log(err);
        assert.ifError(err);
    }

    console.log('\nIt works!');
    process.exit(0);
});

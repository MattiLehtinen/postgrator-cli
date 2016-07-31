const assert = require('assert');
var async = require('async');
const postgratorCli = require('../postgrator-cli');

const originalConsoleLog = console.log;

var tests = [];

var log = '';
var consoleLogCapture = function() {
    log += [].slice.call(arguments);    
}

var removeVersionTable = function(options, callback) {
    var config = {
        migrationDirectory: options['migration-directory'],
        driver: options.driver,
        host: options.host,
        port: options.port,
        database: options.database,
        username: options.username,
        password: options.password
    };    
    console.log('\n----- ' + config.driver + ' removing tables -----');
    var pg = require('../node_modules/postgrator/postgrator.js');
    pg.setConfig(config);
    pg.runQuery('DROP TABLE IF EXISTS schemaversion, animal, person', function (err) {
        assert.ifError(err);
        pg.endConnection(callback);
    });
}


/* A function to build a set of tests for a given config.
   This will be helpful when we want to run the same kinds of tests on
   postgres, mysql, sql server, etc.
============================================================================= */
var buildTestsForOptions = function (options) {

    tests.push(function(callback) {
        removeVersionTable(options, function(err) {
            assert.ifError(err);
            return callback();            
        });
    });
    
    tests.push(function (callback) {
        console.log('\n----- testing show help (output suppressed)-----');
        options.help = true;

        console.log = consoleLogCapture;
        postgratorCli.run(options, function(err, migrations) {
            options.help = false;
            assert.strictEqual(migrations, undefined)
            assert.ok(log.indexOf("Examples") >= 0, "No help was displayed");
            assert.ifError(err);
            return callback();
        });
    });
    
    tests.push(function (callback) {
        console.log('\n----- testing show version (output suppressed)-----');
        options.version = true;
                
        console.log = consoleLogCapture;
        postgratorCli.run(options, function(err, migrations) {
            options.version = false;
            assert.strictEqual(migrations, undefined)
            assert.ok(log.indexOf('Version: ') >= 0, "No version was displayed");
            assert.ifError(err);
            return callback();
        });
    });  

    tests.push(function (callback) {
        console.log('\n----- testing migration to 003 -----');
        postgratorCli.run(options, function(err, migrations) {
            assert.equal(migrations.length, 3);
            assert.equal(migrations[2].version, 3);
            assert.ifError(err);
            return callback();
        });
    });

    tests.push(function (callback) {
        console.log('\n----- testing migration to 000 -----');
        options.to = "0";
        postgratorCli.run(options, function(err, migrations) {
            assert.equal(migrations.length, 3);
            assert.equal(migrations[2].version, 1);
            assert.equal(migrations[2].direction, 'undo');
            assert.ifError(err);
            return callback();
        });
    });

    tests.push(function (callback) {
        console.log('\n----- testing migration to 001 -----');
        options.to = 1;        
        postgratorCli.run(options, function(err, migrations) {
            assert.equal(migrations.length, 1);
            assert.equal(migrations[0].version, 1);
            assert.equal(migrations[0].direction, 'do');
            assert.ifError(err);
            return callback();
        });
    });    

    tests.push(function (callback) {
        console.log('\n----- testing migration from 001 to 003 using config file -----');
        options.to = '0003';
        options.username = '';
        options.database = '';
        options.config = 'test/sample-config.json'

        postgratorCli.run(options, function(err, migrations) {
            assert.strictEqual(migrations[0].schemaVersionSQL, undefined)
            assert.equal(migrations[migrations.length-1].version, 3);
            assert.ok(migrations[migrations.length-1].schemaVersionSQL);
            assert.ifError(err);
            return callback();
        });
    });    

    tests.push(function (callback) {
        console.log('\n----- testing migration from 003 to 002 using config file -----');
        options.to = '02';
        options.username = '';
        options.database = '';
        options.config = 'test/sample-config.json'

        postgratorCli.run(options, function(err, migrations) {            
            assert.ok(migrations[0].schemaVersionSQL)
            assert.equal(migrations[0].version, 3);
            assert.equal(migrations[0].action, 'undo');
            assert.ifError(err);
            return callback();
        });
    });    

    tests.push(function (callback) {
        console.log('\n----- testing non-existing config file-----');
        options.config = 'test/config-which-does-not-exist.json'
        options.to = '003';

        postgratorCli.run(options, function(err, migrations) {         
            assert(err);
            assert(err.message.indexOf("Config file not found:") >= 0);
            return callback();
        });
    });    

    tests.push(function (callback) {
        console.log('\n----- testing empty password-----');
        var originalPassword = options.password;
        options.config = '';
        options.password = '';
                
        postgratorCli.run(options, function(err, migrations) {            
            options.password = originalPassword;
            assert(err.length > 0);
            return callback(null);
        });
    });

    tests.push(function (callback) {
        console.log('\n----- testing showing help without any cmd params-----');
        var originalOptions = options;
        options = {};
                
        console.log = consoleLogCapture;
        postgratorCli.run(options, function(err, migrations) {
            options = originalOptions;
            assert.strictEqual(migrations, undefined)
            assert.ok(log.indexOf("Examples") >= 0, "No help was displayed");
            assert.ok(err.message.indexOf("Migration version number must be specified") >= 0, "No migration version error was displayed");
            return callback();
        });
    });       
           
    tests.push(function (callback) {
        console.log('\n----- testing showing help without specifying to-----');        
        options.to = '';
                
        console.log = consoleLogCapture;
        postgratorCli.run(options, function(err, migrations) {
            assert.strictEqual(migrations, undefined)
            assert.ok(log.indexOf("Examples") >= 0, "No help was displayed");
            assert.ok(err.message.indexOf("Migration version number must be specified") >= 0, "No migration version error was displayed");
            return callback();
        });
    });                 
};

var options = { 
    to: 3,
    driver: 'pg',
    host: '127.0.0.1',
    port: '5432',
    database: 'postgrator',
    username: 'postgrator',
    password: 'postgrator',
    'migration-directory': 'test/migrations' 
}

// Command line parameters
buildTestsForOptions(options);


// Run the tests 
console.log("Running " + tests.length + " tests");
async.eachSeries(tests, function(testFunc, callback) {
    console.log = originalConsoleLog;
    log = '';    
	testFunc(callback);
}, function (err) { 
    if(err) {
        console.log(err);
    	assert.ifError(err);
    } 

    console.log('\nIt works!');	
	process.exit(0);
});

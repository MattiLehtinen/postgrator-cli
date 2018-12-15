/* eslint max-len: 0 */

const pjson = require('./package.json');

const DEFAULT_MIGRATION_DIRECTORY = 'migrations';

/* eslint-disable object-property-newline */

const optionDefinitions = [
    {
        name: 'to', description: "Version number of the file to migrate to or 'max'. Default: 'max'",
        type: String, typeLabel: 'version', defaultOption: true, defaultValue: 'max',
    },
    {
        name: 'driver', description: "Database driver. Default: 'pg'",
        alias: 'r', type: String, typeLabel: 'pg|mysql|mssql', defaultValue: 'pg',
    },
    {
        name: 'host', description: "Host. Default: '127.0.0.1'",
        alias: 'h', type: String, typeLabel: '{underline hostname}', defaultValue: '127.0.0.1',
    },
    {
        name: 'port', description: "Host. Default: '5432'",
        alias: 'o', type: Number, typeLabel: '{underline port}', defaultValue: '5432',
    },
    {
        name: 'database', description: 'Database name',
        alias: 'd', type: String, typeLabel: '{underline database}', defaultValue: '',
    },
    {
        name: 'username', description: 'Username',
        alias: 'u', type: String, typeLabel: '{underline database}', defaultValue: '',
    },
    {
        name: 'password', description: 'Password',
        alias: 'p', type: String, typeLabel: '{underline password}', defaultValue: '',
    },
    {
        name: 'migration-directory', description: "A directory to run migration files from. Default: 'migrations''",
        alias: 'm', type: String, typeLabel: '{underline directory}', defaultValue: 'migrations',
    },
    {
        name: 'secure', description: 'Secure connection (Azure). Default: false',
        alias: 's', type: Boolean,
    },
    {
        name: 'detect-version-conflicts', description: 'Show an error and do not run any migrations if there are multiple migration files with same version number',
        alias: 't', type: Boolean,
    },
    {
        name: 'config', description: 'Load configuration from a JSON file.  With a configuration file you can also use additional configuration parameters available on postgrator. See syntax from https://github.com/rickbergfalk/postgrator',
        alias: 'c', type: String, typeLabel: '{underline file}',
    },
    {
        name: 'version', description: 'Print version.',
        alias: 'v', type: Boolean,
    },
    {
        name: 'help', description: 'Print this usage guide.',
        alias: '?', type: Boolean,
    },
];

const sections = [
    {
        header: 'Postgrator CLI',
        content: {
            options: { columns: [{ name: 'one', maxWidth: 200 }] },
            data: [
                { one: 'postgrator [[--to=]version] [--database=<db>] [--driver=<driver>] [--host=<host>] [--port=<port>] [--username=<username>] [--password=<password>]' },
                { one: 'postgrator [[--to=]version] [--config=<config>]' },
            ],
        },
    },
    {
        header: 'Options',
        optionList: optionDefinitions,
    },
    {
        header: 'Examples',
        content: [
            {
                desc: '1. Specify parameters on command line',
                example: 'postgrator 23 --host 127.0.0.1 --database sampledb --username testuser --password testpassword',
            },
            {
                desc: '2. Use configuration file',
                example: 'postgrator 2 --config myConfig.json',
            },
            {
                desc: '3. Use default configuration file (postgrator.json)',
                example: 'postgrator 5',
            },
            {
                desc: '4. Migrate to latest version using default configuration file (postgrator.json)',
                example: 'postgrator',
            },
        ],
    },
    {
        header: 'About',
        content: [
            `postgrator-cli v. ${pjson.version}`,
            '{underline https://github.com/MattiLehtinen/postgrator-cli}',
        ],
    },
];

module.exports.sections = sections;
module.exports.optionList = optionDefinitions;
module.exports.DEFAULT_MIGRATION_DIRECTORY = DEFAULT_MIGRATION_DIRECTORY;

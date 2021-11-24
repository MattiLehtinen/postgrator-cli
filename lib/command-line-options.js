/* eslint max-len: 0 */

import commandLineArgs from 'command-line-args';
import { readFileSync } from 'fs';

const pjson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));

export const DEFAULT_MIGRATION_PATTERN = 'migrations/*';

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
        name: 'password', description: 'Password. If parameter without value is given, password will be asked.',
        alias: 'p', type: String, typeLabel: '[{underline password}]', defaultValue: '',
    },
    {
        name: 'migration-pattern', description: "A pattern matching files to run migration files from. Default: 'migrations/*''",
        alias: 'm', type: String, typeLabel: '{underline directory}', defaultValue: DEFAULT_MIGRATION_PATTERN,
    },
    {
        name: 'schema-table', description: 'Table created to track schema version.',
        alias: 't', type: String, defaultValue: 'schemaversion',
    },
    {
        name: 'validate-checksum', description: 'Validates checksum of existing SQL migration files already run prior to executing migrations.',
        alias: 'c', type: Boolean, defaultValue: true,
    },
    {
        name: 'ssl', description: 'Enables ssl connections. When using the mysql driver it expects a string containing name of ssl profile.',
        alias: 's',
    },
    {
        name: 'no-config', description: 'Disable config loading',
        type: Boolean,
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

export const parse = (options) => {
    const args = commandLineArgs(optionDefinitions, options);
    if (args.ssl === null) { // If no value is handed, treat it as boolean
        args.ssl = true;
    }
    return args;
};

export const sections = [
    {
        header: 'Postgrator CLI',
        content: {
            options: { columns: [{ name: 'one', maxWidth: 200 }] },
            data: [
                { one: 'postgrator [[--to=]version] [--database=<db>] [--driver=<driver>] [--host=<host>] [--port=<port>] [--username=<username>] [--password=<password>] [--no-config]' },
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
                desc: '2. Explicitly disable loading configuration file',
                example: 'postgrator 2 --no-config',
            },
            {
                desc: '3. Use default configuration file to migrate to version 5',
                example: 'postgrator 5',
            },
            {
                desc: '4. Migrate to latest version using the configuration files',
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

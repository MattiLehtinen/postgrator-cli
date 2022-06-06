/* eslint max-len: 0 */

import { readFileSync } from 'node:fs';
import commandLineArgs from 'command-line-args';

import parse, { optionDefinitions as extraDefinitions } from './commands/index.js'; // eslint-disable-line import/extensions

const pjson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));

export const DEFAULT_MIGRATION_PATTERN = 'migrations/*';

const commandDefinitions = [
    { name: 'cmd', defaultOption: true, defaultValue: null },
];

const optionDefinitions = (defaults = {}) => [
    {
        name: 'driver',
        description: "Database driver. Default: 'pg'",
        alias: 'r',
        type: String,
        typeLabel: 'pg|mysql|mssql|sqlite3',
        defaultValue: defaults.driver || 'pg',
    },
    {
        name: 'host',
        description: 'Host.',
        alias: 'h',
        type: String,
        typeLabel: '{underline hostname}',
        ...defaults.host && { defaultValue: defaults.host },
    },
    {
        name: 'port',
        description: 'Port.',
        alias: 'o',
        type: Number,
        typeLabel: '{underline port}',
        ...defaults.port && { defaultValue: defaults.port },
    },
    {
        name: 'database',
        description: 'Database name. In the case of sqlite3, this is the filename, or it defaults to :memory:',
        alias: 'd',
        type: String,
        typeLabel: '{underline database}',
        ...defaults.database && { defaultValue: defaults.database },
    },
    {
        name: 'username',
        description: 'Username',
        alias: 'u',
        type: String,
        typeLabel: '{underline database}',
        ...defaults.username && { defaultValue: defaults.username },
    },
    {
        name: 'password',
        description: 'Password. If parameter without value is given, password will be asked.',
        alias: 'p',
        type: String,
        typeLabel: '[{underline password}]',
        ...defaults.password && { defaultValue: defaults.password },
    },
    {
        name: 'migration-pattern',
        description: "A pattern matching files to run migration files from. Default: 'migrations/*'",
        alias: 'm',
        type: String,
        typeLabel: '{underline directory}',
        defaultValue: defaults.migrationPattern || DEFAULT_MIGRATION_PATTERN,
    },
    {
        name: 'schema-table',
        description: 'Table created to track schema version.',
        alias: 't',
        type: String,
        ...defaults.schemaTable && { defaultValue: defaults.schemaTable },
    },
    {
        name: 'validate-checksum',
        description: 'Validates checksum of existing SQL migration files already run prior to executing migrations.',
        type: Boolean,
        ...defaults.validateChecksum && { defaultValue: defaults.validateChecksum },
    },
    {
        name: 'ssl',
        description: 'Enables ssl connections. When using the mysql driver it expects a string containing name of ssl profile.',
        alias: 's',
        ...defaults.ssl && { defaultValue: defaults.ssl },
    },
    {
        name: 'config',
        description: 'Select the config file explicitly.',
        alias: 'c',
        type: String,
        typeLabel: '{underline file}',
    },
    {
        name: 'no-config',
        description: 'Disable config loading',
        type: Boolean,
    },
    {
        name: 'version',
        description: 'Print version.',
        alias: 'v',
        type: Boolean,
    },
    {
        name: 'help',
        description: 'Print this usage guide.',
        alias: '?',
        type: Boolean,
    },
];

export default (argv, defaults) => {
    const { cmd, _unknown: unknown } = commandLineArgs(commandDefinitions, { stopAtFirstUnknown: true, argv });
    const { command, definitions = [], constants = {} } = parse(cmd, defaults);

    const args = commandLineArgs([...definitions, ...optionDefinitions(defaults)], { argv: unknown || [] });
    if (args.ssl === null && defaults.ssl === undefined) { // If no value is handed, treat it as boolean
        args.ssl = true;
    }

    return {
        command,
        ...constants,
        ...args,
    };
};

export const sections = [
    {
        header: 'Postgrator CLI',
        content: {
            options: { columns: [{ name: 'one', maxWidth: 200 }] },
            data: [
                { one: 'postgrator [[--to=]version] [--database=<db>] [--driver=<driver>] [--host=<host>] [--port=<port>] [--username=<username>] [--password=<password>] [--no-config]' },
                { one: 'postgrator [[--to=]version] [--config=<config>]' },
                { one: 'postgrator migrate [[--to=]version]' },
                { one: 'postgrator drop-schema' },
            ],
        },
    },
    {
        header: 'Options',
        optionList: [...extraDefinitions(), ...optionDefinitions()],
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
            {
                desc: '5. Drop the schema table',
                example: 'postgrator drop-schema',
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

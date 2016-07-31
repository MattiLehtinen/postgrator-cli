# Postgrator CLI

A command line runner for [Postgrator](https://github.com/rickbergfalk/postgrator) - A Node.js SQL migration tool using a directory of plain SQL scripts.
Supports Postgres, MySQL, and SQL Server.


This repository uses [Postgrator](https://github.com/rickbergfalk/postgrator) node.js library developed by [Rick Bergfalk](https://github.com/rickbergfalk) who is not responsible of maintaining this repository.

## Installation

```
npm install -g postgrator-cli
```

Or if you prefer to use it on npm scripts on package.json:

```
npm install postgrator-cli --save-dev
```

## Usage

### SQL Files

Create a folder and stick some SQL scripts in there that change your database in some way. It might look like:

```
migrations/
  |- 001.do.sql
  |- 001.undo.sql
  |- 002.do.optional-description-of-script.sql
  |- 002.undo.optional-description-of-script.sql
  |- 003.do.sql
  |- 003.undo.sql
  |- ... and so on
```

The files must follow the convention [version].[action].[optional-description].sql.

**Version** must be a number, but you may start and increment the numbers in any way you'd like.
If you choose to use a purely sequential numbering scheme instead of something based off a timestamp,
you will find it helpful to start with 000s or some large number for file organization purposes.

**Action** must be either "do" or "undo". Do implements the version, and undo undoes it.

**Optional-description** can be a label or tag to help keep track of what happens inside the script. Descriptions should not contain periods.

### The tool

You can specify all the parameters from command line (see below) but the easiest way is to:

1.  Create `postgrator.json` configuration file. Sample:

```
{
    "migrationDirectory": "migrations",
    "driver": "pg",
    "host": "127.0.0.1",
    "port": 5432,
    "database": "myDatabaseName",
    "username": "user",
    "password": "pass"
}
```

2.
Migrate to latest version: 
```
$ postgrator
```

Migrate to version 004 (it knows current version and migrates to up or down automatically): 
```
$ postgrator 4
```
     

### Synopsis

```
postgrator <version> --database=<db> [--driver=<driver>] [--host=<host>] [--port=<port>] [--username=<username>] [--password=<password>]
postgrator <version> [--config=<config>]
```

### Options

```
  --to version number                   Version to migrate to
  -r, --driver pg|mysql|mssql           Database driver. Default: 'pg'
  -h, --host hostname                   Host. Default: '127.0.0.1'
  -o, --port port                       Host. Default: '5432'
  -d, --database database               Database name
  -u, --username database               Username
  -p, --password password               Password
  -m, --migration-directory directory   A directory to run migration files from. Default: 'migrations''
  -c, --config file                     Load configuration from a JSON file. With a configuration file you can also
                                        use additional configuration parameters available on postgrator. See syntax
                                        from https://github.com/rickbergfalk/postgrator
  -v, --version                         Print version.
  -?, --help                            Print this usage guide.

Examples

 1. Specify parameters on command line                       postgrator 23 --host 127.0.0.1 --database sampledb
                                                              --username testuser --password testpassword
  2. Use configuration file                                   postgrator 2 --config myConfig.json
  3. Use default configuration file (postgrator.json)         postgrator 5
  4. Migrate to latest version using default configuration    postgrator
  file (postgrator.json)
```

## Tests
To run postgrator tests locally, you'll need:
- A [postgreSQL](http://www.postgresql.org/download/) instance running on default port (5432), with a `postgrator` (password `postgrator`) account and a `postgrator` database

then run `npm test`

## TODO
* Migrate to latest version if no version number is set
* Use postgrator.json by default
* Allow overriding config file parameters from command line

## License

MIT
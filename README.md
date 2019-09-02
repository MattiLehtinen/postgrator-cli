# Postgrator CLI

Command line SQL migration tool using plain SQL scripts for PostgreSQL, MySQL and SQL Server.

Uses [Postgrator](https://github.com/rickbergfalk/postgrator) node.js library developed by [Rick Bergfalk](https://github.com/rickbergfalk).

## Installation

```
npm install -g postgrator-cli
```

Or if you prefer to use it locally on your project using npm scripts of package.json:

```
npm install postgrator-cli --save-dev
```

And install the appropriate DB engine(s) if not installed yet:

```
npm install pg@7
npm install mysql@2
npm install mssql@4
```

See the [Postgrator](https://github.com/rickbergfalk/postgrator) documentation for more information about the supported engines.

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

* Create `postgrator.json` configuration file. For example:

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

* Migrate to latest version (it looks settings by default from `postgrator.json`):
```
$ postgrator
```

* Migrate to version 004 (it knows current version and migrates up/down automatically):
```
$ postgrator 4
```


### Synopsis

```
postgrator [[--to=]<version>] --database=<db> [--driver=<driver>] [--host=<host>] [--port=<port>] [--username=<username>] [--password=<password>]
postgrator [[--to=]<version>] [--config=<config>]
```

### Options

```
  --to version                          Version number of the file to migrate to or 'max'. Default: 'max'
  -r, --driver pg|mysql|mssql           Database driver. Default: 'pg'
  -h, --host hostname                   Host. Default: '127.0.0.1'
  -o, --port port                       Host. Default: '5432'
  -d, --database database               Database name
  -u, --username database               Username
  -p, --password password               Password
  -m, --migration-directory directory   A directory to run migration files from. Default: 'migrations''
  -t, --detect-version-conflicts        Show an error and do not run any migrations if there are multiple migration
                                        files with same version number
  -s, --secure                          Secure connection (Azure). Default: false
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
* Allow overriding config file parameters from command line


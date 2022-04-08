# Changelog

## 5.2.0
### Unreleased
* Add support for `.postgratorrc.mjs` and `.postgratorrc.js` config files with `type: module`.

## 5.1.0
### Feb, 24, 2022
* Upgrade `postgrator@7.0.0`
* Support `*.cjs` and `*.mjs` files

## 5.0.0
### Feb, 19, 2022
* (**Breaking**) Node.js 12 or later required
* (**Breaking**) Target postgrator 5.x.x
* (**Breaking**) Migrate to using cosmiconfig for configuration file
* (**Breaking**) `secure` option is now `ssl` and it works differently for each supported driver
* (**Breaking**) Replace `--migration-directory` option with `--migration-pattern` option
* Add support for node 16.x.x
* Add drop-schema command
* Add --schema-table option
* Support merging cli and config file options

## 4.0.0
### May, 17, 2020
* (**Breaking**) Node.js 10 or later required
* (**Breaking**) Removed option -t, --detect-version-conflicts. Conflicts are now always detected.
* Add support for node 14.x.x
* Add support for pg 8.x.x

## 3.3.0
### September 9, 2019
* Ask password if -p or --password parameter without value is given or if config file does not contain password.
* Fix node6 compatibility

## 3.2.0
### September 2, 2019
* Update dependencies

## 3.1.0
### December 12, 2018
* Added option `detect-version-conflicts` to detect if there are multiple migration files with same version number.

## 3.0.0
### July 1, 2018
* Upgraded for Postgrator 3.

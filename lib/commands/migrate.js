export const COMMAND_MIGRATE = 'migrate';

function logMessage(message) {
    // Using the system default time locale/options for now
    const messagePrefix = `[${new Date().toLocaleTimeString()}]`;
    console.log(`${messagePrefix} ${message}`);
}

export const optionDefinitions = (defaults = {}, defaultOption = false) => [
    {
        name: 'to',
        description: "Version number of the file to migrate to or 'max'. Default: 'max'",
        type: String,
        typeLabel: 'version',
        defaultValue: defaults.to || 'max',
        defaultOption,
    },
];

/**
 * Gets version to migrate to as number
 * @param {string|number} to    Version or "max"
 * @param {object} postgrator
 * @returns {Promise<number>} Version to migrate to
 */
function getMigrateToVersion(to, postgrator) {
    if (to === 'max') {
        return postgrator.getMaxVersion();
    }
    return Promise.resolve(to);
}

function checkMigrations(migrations, migrationPattern) {
    if (!migrations || migrations.length === 0) {
        return Promise.reject(new Error(`No migration files found from "${migrationPattern}"`));
    }
    return Promise.resolve();
}

export default async (postgrator, { to, migrationPattern }) => {
    // Postgrator events
    postgrator.on(
        'validation-started',
        (migration) => logMessage(`verifying checksum of migration ${migration.filename}`),
    );
    postgrator.on(
        'migration-started',
        (migration) => logMessage(`running ${migration.filename}`),
    );

    const migrations = await postgrator.getMigrations();
    await checkMigrations(migrations, migrationPattern);
    const toVersion = await getMigrateToVersion(to, postgrator);
    const databaseVersion = await postgrator.getDatabaseVersion().catch(() => {
        logMessage(`table ${postgrator.commonClient.quotedSchemaTable()} does not exist - creating it.`);
        return 0;
    });

    logMessage(`version of database is: ${databaseVersion}`);
    logMessage(`migrating ${(toVersion >= databaseVersion) ? 'up' : 'down'} to ${toVersion}`);

    return postgrator.migrate(to);
};

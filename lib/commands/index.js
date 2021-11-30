import migrate, { COMMAND_MIGRATE, optionDefinitions as migrateDefinitions } from './migrate.js'; // eslint-disable-line import/extensions
import dropSchema, { COMMAND_DROP_SCHEMA } from './drop-schema.js'; // eslint-disable-line import/extensions

export const optionDefinitions = migrateDefinitions;

export default (command, defaults = {}) => {
    if (command === 'max') {
        return {
            command: migrate,
            definitions: [],
            constants: { to: 'max' },
        };
    }

    if (isPositiveInteger(command)) {
        return {
            command: migrate,
            definitions: [],
            constants: { to: parseInt(command, 10) },
        };
    }

    if (command === COMMAND_MIGRATE || command === null) {
        return {
            command: migrate,
            definitions: migrateDefinitions(defaults, command === null),
        };
    }

    if (command === COMMAND_DROP_SCHEMA) {
        return {
            command: dropSchema,
            definitions: [],
        };
    }

    return {
        command: () => Promise.reject(new Error('Invalid command.')),
        definitions: [],
    };
};

function isPositiveInteger(val) {
    const parsed = parseFloat(val);
    return Number.isInteger(parsed) && parsed >= 0;
}

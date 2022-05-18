export const COMMAND_DROP_SCHEMA = 'drop-schema';

export default (postgrator) => {
    const schemaTable = postgrator.commonClient.quotedSchemaTable();
    return postgrator
        .runQuery(`DROP TABLE ${schemaTable}`)
        .then(() => {});
};

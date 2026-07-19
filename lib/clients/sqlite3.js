// eslint-disable-next-line n/no-unsupported-features/node-builtins -- node:sqlite is a release candidate, not yet marked stable
import { DatabaseSync } from "node:sqlite";

export default ({ database }) => {
    const db = new DatabaseSync(database || ":memory:");

    return {
        connect: () => {},
        query: async (query) => ({ rows: db.prepare(query).all() }),
        execSqlScript: async (query) => db.exec(query),
        end: async () => db.close(),
    };
};

// eslint-disable-next-line n/no-unsupported-features/node-builtins -- node:sqlite is a release candidate, not yet marked stable
import { DatabaseSync } from "node:sqlite";

export default ({ database }) => {
    const db = new DatabaseSync(database || ":memory:");

    return {
        connect: () => {},
        query: (query) => ({ rows: db.prepare(query).all() }),
        execSqlScript: (query) => db.exec(query),
        end: () => db.close(),
    };
};

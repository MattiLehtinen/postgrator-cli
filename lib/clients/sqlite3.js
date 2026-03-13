import { promisify } from 'node:util';
import sqlite3 from 'sqlite3';

export default ({ database }) => {
    const db = new sqlite3.Database(database || ':memory:');

    return {
        connect: () => {},
        query: (query) => new Promise((resolve, reject) => {
            db.all(query, (err, rows) => {
                if (err) {
                    return reject(err);
                }
                return resolve({ rows });
            });
        }),
        execSqlScript: (query) => new Promise((resolve, reject) => {
            db.exec(query, (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        }),
        end: promisify(db.close.bind(db)),
    };
};

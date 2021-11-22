import { promisify } from 'util';
import { createConnection } from 'mysql';

// secure does not apply here
export default ({ username, secure, ...config }) => {
    const connection = createConnection({
        multipleStatements: true,
        ...config,
        ...username !== undefined ? { user: username } : {},
    });

    return {
        connect: promisify(connection.connect.bind(connection)),
        query: (query) => new Promise((resolve, reject) => {
            connection.query(query, (err, rows, fields) => (err ? reject(err) : resolve({ rows, fields })));
        }),
        end: promisify(connection.end.bind(connection)),
    };
};

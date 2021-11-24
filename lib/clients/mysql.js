import { promisify } from 'util';
import { createConnection } from 'mysql';

export default ({ username, ssl, ...config }) => {
    const connection = createConnection({
        multipleStatements: true,
        ...config,
        ...username !== undefined ? { user: username } : {},
        ...ssl !== undefined ? { ssl } : {},
    });

    return {
        connect: promisify(connection.connect.bind(connection)),
        query: (query) => new Promise((resolve, reject) => {
            connection.query(query, (err, rows, fields) => (err ? reject(err) : resolve({ rows, fields })));
        }),
        end: promisify(connection.end.bind(connection)),
    };
};

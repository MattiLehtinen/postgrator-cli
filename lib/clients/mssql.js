import mssql from 'mssql';

// TODO: one day use named exports
const { ConnectionPool, Request } = mssql;

export default ({
    username, host, secure, ...config
}) => {
    const connection = new ConnectionPool({
        ...config,
        ...host !== undefined ? { server: host } : {},
        ...username !== undefined ? { user: username } : {},
        ...secure !== undefined ? { options: { encrypt: secure } } : {},
    });

    return {
        connect: () => connection.connect(),
        query: (query) => new Promise((resolve, reject) => {
            const request = new Request(connection);
            const batches = query.split(/^\s*GO\s*$/im);

            function runBatch(batchIndex) {
                request.batch(batches[batchIndex], (err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    if (batchIndex === batches.length - 1) {
                        return resolve({
                            rows: result && result.recordset ? result.recordset : result,
                        });
                    }
                    return runBatch(batchIndex + 1);
                });
            }

            runBatch(0);
        }),
        end: () => Promise.resolve(connection.close()),
    };
};

import pg from 'pg';

// secure does not apply here
export default ({ username, secure, ...config }) => {
    const client = new pg.Client({
        ...config,
        ...username !== undefined ? { user: username } : {},
    });

    return {
        connect: () => client.connect(),
        query: (query) => client.query(query),
        end: () => client.end(),
    };
};

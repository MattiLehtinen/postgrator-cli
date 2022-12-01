import pg from 'pg';

export default ({ username, ...config }) => {
    const client = new pg.Client({
        ...config,
        ...username === undefined ? {} : { user: username },
    });

    return {
        connect: () => client.connect(),
        query: (query) => client.query(query),
        end: () => client.end(),
    };
};

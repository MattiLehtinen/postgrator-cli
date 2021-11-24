import pg from 'pg';

export default ({ username, ssl, ...config }) => {
    const client = new pg.Client({
        ...config,
        ...username !== undefined ? { user: username } : {},
        ...ssl !== undefined ? { ssl } : {},
    });

    return {
        connect: () => client.connect(),
        query: (query) => client.query(query),
        end: () => client.end(),
    };
};

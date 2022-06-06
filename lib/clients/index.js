export default async (driver, config) => {
    const { default: getClient } = await (
        driver === 'pg'
            ? import('./pg.js') // eslint-disable-line import/extensions
            : driver === 'mysql'
                ? import('./mysql.js') // eslint-disable-line import/extensions
                : driver === 'mssql'
                    ? import('./mssql.js') // eslint-disable-line import/extensions
                    : driver === 'sqlite3'
                        ? import('./sqlite3.js') // eslint-disable-line import/extensions
                        : Promise.reject(new Error('The supported drivers are pg|mysql|mssql|sqlite3'))
    );
    return getClient(config);
};

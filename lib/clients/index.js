export default async (driver, config) => {
    const { default: getClient } = await (
        driver === 'pg' // eslint-disable-line no-nested-ternary
            ? import('./pg.js') // eslint-disable-line import/extensions
            : driver === 'mysql' // eslint-disable-line no-nested-ternary
                ? import('./mysql.js') // eslint-disable-line import/extensions
                : driver === 'mssql'
                    ? import('./mssql.js') // eslint-disable-line import/extensions
                    : Promise.reject(new Error('The supported drivers are pg|mysql|mssql'))
    );
    return getClient(config);
};

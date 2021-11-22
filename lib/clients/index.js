export default async (driver, config) => {
    const { default: getClient } = await (
        driver === 'pg'
            ? import('./pg.js') // eslint-disable-line import/extensions
            : Promise.reject(new Error('The supported drivers are pg'))
    );
    return getClient(config);
};

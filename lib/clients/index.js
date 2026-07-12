export default async (driver, config) => {
    const { default: getClient } = await (driver === "pg"
        ? import("./pg.js")
        : driver === "mysql"
          ? import("./mysql.js")
          : driver === "mssql"
            ? import("./mssql.js")
            : driver === "sqlite3"
              ? import("./sqlite3.js")
              : Promise.reject(
                    new Error(
                        "The supported drivers are pg|mysql|mssql|sqlite3",
                    ),
                ));
    return getClient(config);
};

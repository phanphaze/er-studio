import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

export function openLocalDatabase(filename, migrationsDirectory) {
  mkdirSync(dirname(filename), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  try {
    sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    sqlite.exec(
      "CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)",
    );
    for (const name of readdirSync(migrationsDirectory)
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      if (
        sqlite
          .prepare("SELECT name FROM _local_migrations WHERE name = ?")
          .get(name)
      )
        continue;
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        sqlite.exec(readFileSync(join(migrationsDirectory, name), "utf8"));
        sqlite
          .prepare("INSERT INTO _local_migrations (name) VALUES (?)")
          .run(name);
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    }
  } catch (error) {
    sqlite.close();
    throw error;
  }
  return {
    close: () => sqlite.close(),
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let values = [];
      return {
        bind(...args) {
          values = args;
          return this;
        },
        async first() {
          return statement.get(...values) ?? null;
        },
        async all() {
          return { results: statement.all(...values) };
        },
        async run() {
          return {
            meta: { changes: Number(statement.run(...values).changes) },
          };
        },
      };
    },
  };
}

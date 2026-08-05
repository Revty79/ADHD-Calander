import { migrations } from "./migrations";
import { SqlExecutor } from "./sql";

type MigrationRow = {
  version: number;
};

export class DatabaseInitializationError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "DatabaseInitializationError";
    this.cause = cause;
  }
}

export async function initializeDatabase(database?: SqlExecutor): Promise<SqlExecutor> {
  const activeDatabase = database ?? (await openDefaultDatabase());

  try {
    await activeDatabase.execAsync(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    const appliedRows = await activeDatabase.getAllAsync<MigrationRow>(
      "SELECT version FROM schema_migrations;"
    );
    const appliedVersions = new Set(appliedRows.map((row) => row.version));
    const orderedMigrations = [...migrations].sort((first, second) => {
      return first.version - second.version;
    });

    for (const migration of orderedMigrations) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      await migration.up(activeDatabase);
      await activeDatabase.runAsync(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);",
        migration.version,
        migration.name,
        new Date().toISOString()
      );
    }
  } catch (error) {
    throw new DatabaseInitializationError("Unable to initialize local database.", error);
  }

  return activeDatabase;
}

async function openDefaultDatabase(): Promise<SqlExecutor> {
  const { openExpoDatabase } = await import("./expoSqlite");

  return openExpoDatabase();
}

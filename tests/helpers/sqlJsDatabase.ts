import initSqlJs, { Database } from "sql.js";

import { SqlExecutor, SqlRunResult, SqlValue } from "../../src/database/sql";

let sqlJsPromise: ReturnType<typeof initSqlJs> | null = null;

export async function createSqlJsDatabase(data?: Uint8Array): Promise<SqlJsDatabase> {
  sqlJsPromise ??= initSqlJs({
    locateFile: (file) => `node_modules/sql.js/dist/${file}`
  });

  const sqlJs = await sqlJsPromise;

  return new SqlJsDatabase(new sqlJs.Database(data));
}

export class SqlJsDatabase implements SqlExecutor {
  constructor(private readonly database: Database) {}

  exportData(): Uint8Array {
    return this.database.export();
  }

  async execAsync(sql: string): Promise<void> {
    this.database.exec(sql);
  }

  async runAsync(sql: string, ...params: SqlValue[]): Promise<SqlRunResult> {
    const statement = this.database.prepare(sql);

    try {
      statement.run(params);

      return {
        changes: this.database.getRowsModified()
      };
    } finally {
      statement.free();
    }
  }

  async getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]> {
    const statement = this.database.prepare(sql);

    try {
      if (params.length > 0) {
        statement.bind(params);
      }

      const rows: T[] = [];

      while (statement.step()) {
        rows.push(statement.getAsObject() as T);
      }

      return rows;
    } finally {
      statement.free();
    }
  }

  async getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, ...params);

    return rows[0] ?? null;
  }
}

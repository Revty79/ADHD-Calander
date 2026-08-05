export type SqlValue = string | number | null;

export type SqlRunResult = {
  changes?: number;
  lastInsertRowId?: number;
};

export type SqlExecutor = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqlValue[]): Promise<SqlRunResult>;
  getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null>;
};

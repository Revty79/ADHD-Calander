import * as SQLite from "expo-sqlite";

import { DATABASE_NAME } from "./constants";
import { SqlExecutor } from "./sql";

export async function openExpoDatabase(name = DATABASE_NAME): Promise<SqlExecutor> {
  const database = await SQLite.openDatabaseAsync(name);

  return database as unknown as SqlExecutor;
}

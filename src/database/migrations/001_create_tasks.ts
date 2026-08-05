import { taskStatuses } from "../../types/task";
import { Migration } from "./types";

const allowedStatuses = taskStatuses.map((status) => `'${status}'`).join(", ");

export const createTasksMigration: Migration = {
  version: 1,
  name: "create_tasks",
  async up(database) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (${allowedStatuses})),
        scheduled_date TEXT NOT NULL,
        scheduled_time TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        deleted_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_date
        ON tasks (scheduled_date, deleted_at, status);

      CREATE INDEX IF NOT EXISTS idx_tasks_updated_at
        ON tasks (updated_at);
    `);
  }
};

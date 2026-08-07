import { taskStatuses } from "../../types/task";
import { Migration } from "./types";

const allowedStatuses = taskStatuses.map((status) => `'${status}'`).join(", ");

export const calendarFoundationMigration: Migration = {
  version: 2,
  name: "calendar_foundation",
  async up(database) {
    try {
      await database.execAsync(`
        BEGIN IMMEDIATE;

      CREATE TABLE tasks_v2 (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (${allowedStatuses})),
        scheduled_date TEXT,
        scheduled_time TEXT,
        estimated_duration_minutes INTEGER CHECK (
          estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0
        ),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        deleted_at TEXT
      );

      INSERT INTO tasks_v2 (
        id,
        title,
        description,
        status,
        scheduled_date,
        scheduled_time,
        estimated_duration_minutes,
        created_at,
        updated_at,
        completed_at,
        deleted_at
      )
      SELECT
        id,
        title,
        description,
        status,
        scheduled_date,
        scheduled_time,
        NULL,
        created_at,
        updated_at,
        completed_at,
        deleted_at
      FROM tasks;

      DROP TABLE tasks;
      ALTER TABLE tasks_v2 RENAME TO tasks;

      CREATE INDEX idx_tasks_scheduled_date
        ON tasks (scheduled_date, deleted_at, status);

      CREATE INDEX idx_tasks_updated_at
        ON tasks (updated_at);

      CREATE TABLE calendar_events (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'fixed' CHECK (kind = 'fixed'),
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration_minutes INTEGER CHECK (
          duration_minutes IS NULL OR duration_minutes > 0
        ),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (end_time IS NULL OR duration_minutes IS NULL)
      );

      CREATE INDEX idx_calendar_events_date_start
        ON calendar_events (date, start_time);

      CREATE INDEX idx_calendar_events_updated_at
        ON calendar_events (updated_at);

        COMMIT;
      `);
    } catch (error) {
      try {
        await database.execAsync("ROLLBACK;");
      } catch {}

      throw error;
    }
  }
};

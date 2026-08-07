import {
  recoveryDecisionTypes,
  recoveryItemStatuses,
  recoverySessionStatuses
} from "../../types/recovery";
import { taskStatuses } from "../../types/task";
import { Migration } from "./types";

const allowedTaskStatuses = taskStatuses.map((status) => `'${status}'`).join(", ");
const allowedSessionStatuses = recoverySessionStatuses
  .map((status) => `'${status}'`)
  .join(", ");
const allowedItemStatuses = recoveryItemStatuses
  .map((status) => `'${status}'`)
  .join(", ");
const allowedDecisions = recoveryDecisionTypes
  .map((decision) => `'${decision}'`)
  .join(", ");

export const recoveryFoundationMigration: Migration = {
  version: 3,
  name: "recovery_foundation",
  async up(database) {
    try {
      await database.execAsync(`
        BEGIN IMMEDIATE;

        CREATE TABLE tasks_v3 (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'not_started' CHECK (
            status IN (${allowedTaskStatuses})
          ),
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

        INSERT INTO tasks_v3 (
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
          estimated_duration_minutes,
          created_at,
          updated_at,
          completed_at,
          deleted_at
        FROM tasks;

        DROP TABLE tasks;
        ALTER TABLE tasks_v3 RENAME TO tasks;

        CREATE INDEX idx_tasks_scheduled_date
          ON tasks (scheduled_date, deleted_at, status);

        CREATE INDEX idx_tasks_updated_at
          ON tasks (updated_at);

        CREATE TABLE recovery_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          source_date TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN (${allowedSessionStatuses})),
          started_at TEXT NOT NULL,
          completed_at TEXT
        );

        CREATE UNIQUE INDEX idx_recovery_sessions_one_active
          ON recovery_sessions (status)
          WHERE status = 'active';

        CREATE INDEX idx_recovery_sessions_completed_at
          ON recovery_sessions (completed_at);

        CREATE TABLE recovery_items (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL REFERENCES recovery_sessions (id) ON DELETE CASCADE,
          task_id TEXT NOT NULL REFERENCES tasks (id),
          original_title TEXT NOT NULL,
          original_status TEXT NOT NULL CHECK (
            original_status IN (${allowedTaskStatuses})
          ),
          original_scheduled_date TEXT NOT NULL,
          original_scheduled_time TEXT,
          original_estimated_duration_minutes INTEGER CHECK (
            original_estimated_duration_minutes IS NULL OR
            original_estimated_duration_minutes > 0
          ),
          status TEXT NOT NULL CHECK (status IN (${allowedItemStatuses})),
          decision TEXT CHECK (decision IS NULL OR decision IN (${allowedDecisions})),
          note TEXT,
          rescheduled_date TEXT,
          rescheduled_time TEXT,
          created_task_ids TEXT NOT NULL DEFAULT '[]',
          reviewed_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (session_id, task_id)
        );

        CREATE INDEX idx_recovery_items_session
          ON recovery_items (session_id, status, created_at);

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

import { Migration } from "./types";

export const executionMultipleRemindersMigration: Migration = {
  version: 7,
  name: "execution_multiple_reminders",
  async up(database) {
    try {
      await database.execAsync(`
        BEGIN IMMEDIATE;

        ALTER TABLE tasks
          ADD COLUMN started_at TEXT;

        ALTER TABLE tasks
          ADD COLUMN reminder_offsets TEXT NOT NULL DEFAULT '[]';

        UPDATE tasks
        SET started_at = updated_at
        WHERE status = 'started';

        UPDATE tasks
        SET reminder_offsets = CASE
          WHEN reminder_offset_minutes IS NULL THEN '[]'
          ELSE '[' || reminder_offset_minutes || ']'
        END;

        ALTER TABLE calendar_events
          ADD COLUMN reminder_offsets TEXT NOT NULL DEFAULT '[]';

        UPDATE calendar_events
        SET reminder_offsets = CASE
          WHEN reminder_offset_minutes IS NULL THEN '[]'
          ELSE '[' || reminder_offset_minutes || ']'
        END;

        ALTER TABLE recovery_items
          ADD COLUMN original_reminder_offsets TEXT NOT NULL DEFAULT '[]';

        UPDATE recovery_items
        SET original_reminder_offsets = CASE
          WHEN original_reminder_offset_minutes IS NULL THEN '[]'
          ELSE '[' || original_reminder_offset_minutes || ']'
        END;

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

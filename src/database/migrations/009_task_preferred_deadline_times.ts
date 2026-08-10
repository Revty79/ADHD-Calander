import { Migration } from "./types";

export const taskPreferredDeadlineTimesMigration: Migration = {
  version: 9,
  name: "task_preferred_deadline_times",
  async up(database) {
    try {
      await database.execAsync(`
        BEGIN IMMEDIATE;

        ALTER TABLE tasks
          ADD COLUMN preferred_time TEXT
          CHECK (
            preferred_time IS NULL OR
            (scheduled_date IS NOT NULL AND scheduled_time IS NULL)
          );

        ALTER TABLE tasks
          ADD COLUMN deadline_time TEXT
          CHECK (deadline_time IS NULL OR deadline_date IS NOT NULL);

        ALTER TABLE recovery_items
          ADD COLUMN original_preferred_time TEXT;

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

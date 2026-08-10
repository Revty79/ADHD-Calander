import { Migration } from "./types";

export const independentRemindersMigration: Migration = {
  version: 10,
  name: "independent_reminders",
  async up(database) {
    try {
      await database.execAsync(`
        BEGIN IMMEDIATE;

        ALTER TABLE tasks
          ADD COLUMN reminders TEXT;

        ALTER TABLE calendar_events
          ADD COLUMN reminders TEXT;

        ALTER TABLE recovery_items
          ADD COLUMN original_reminders TEXT;

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

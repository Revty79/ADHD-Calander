import { reminderOffsetOptions } from "../../types/reminder";
import { Migration } from "./types";

const allowedReminderOffsets = reminderOffsetOptions.join(", ");

export const settingsRemindersFoundationMigration: Migration = {
  version: 4,
  name: "settings_reminders_foundation",
  async up(database) {
    try {
      await database.execAsync(`
        BEGIN IMMEDIATE;

        ALTER TABLE tasks
          ADD COLUMN reminder_offset_minutes INTEGER CHECK (
            reminder_offset_minutes IS NULL OR
            reminder_offset_minutes IN (${allowedReminderOffsets})
          );

        ALTER TABLE calendar_events
          ADD COLUMN reminder_offset_minutes INTEGER CHECK (
            reminder_offset_minutes IS NULL OR
            reminder_offset_minutes IN (${allowedReminderOffsets})
          );

        ALTER TABLE recovery_items
          ADD COLUMN original_reminder_offset_minutes INTEGER CHECK (
            original_reminder_offset_minutes IS NULL OR
            original_reminder_offset_minutes IN (${allowedReminderOffsets})
          );

        CREATE TABLE app_settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

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

import { Migration } from "./types";

export const plannedTimePreferencesCompatibilityMigration: Migration = {
  version: 8,
  name: "planned_time_preferences",
  async up(database) {
    try {
      await database.execAsync(`
        BEGIN IMMEDIATE;

        ALTER TABLE tasks
          ADD COLUMN planned_time_preference TEXT
          CHECK (
            planned_time_preference IS NULL OR
            planned_time_preference IN ('anytime', 'morning', 'afternoon', 'evening')
          );

        UPDATE tasks
        SET planned_time_preference = CASE
          WHEN scheduled_date IS NULL THEN NULL
          ELSE 'anytime'
        END;

        ALTER TABLE recovery_items
          ADD COLUMN original_planned_time_preference TEXT NOT NULL DEFAULT 'anytime'
          CHECK (
            original_planned_time_preference IN ('anytime', 'morning', 'afternoon', 'evening')
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

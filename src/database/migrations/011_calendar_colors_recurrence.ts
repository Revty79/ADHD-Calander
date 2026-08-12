import { Migration } from "./types";

export const calendarColorsRecurrenceMigration: Migration = {
  version: 11,
  name: "calendar_colors_recurrence",
  async up(database) {
    try {
      await database.execAsync(`
        BEGIN IMMEDIATE;

        ALTER TABLE tasks
          ADD COLUMN color TEXT NOT NULL DEFAULT 'neutral';

        ALTER TABLE calendar_events
          ADD COLUMN color TEXT NOT NULL DEFAULT 'neutral';

        ALTER TABLE calendar_events
          ADD COLUMN recurrence_rule TEXT;

        CREATE TABLE calendar_event_exceptions (
          id TEXT PRIMARY KEY NOT NULL,
          series_id TEXT NOT NULL,
          original_date TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('modified', 'cancelled')),
          overrides TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (series_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
          UNIQUE (series_id, original_date)
        );

        CREATE INDEX idx_calendar_event_exceptions_series_date
          ON calendar_event_exceptions (series_id, original_date);

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

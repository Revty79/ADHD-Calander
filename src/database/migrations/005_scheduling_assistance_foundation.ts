import { Migration } from "./types";

export const schedulingAssistanceFoundationMigration: Migration = {
  version: 5,
  name: "scheduling_assistance_foundation",
  async up(database) {
    await database.execAsync(`
      ALTER TABLE tasks
        ADD COLUMN deadline_date TEXT;
    `);
  }
};

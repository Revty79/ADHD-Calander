import { createTasksMigration } from "./001_create_tasks";
import { calendarFoundationMigration } from "./002_calendar_foundation";
import { Migration } from "./types";

export const migrations: Migration[] = [
  createTasksMigration,
  calendarFoundationMigration
];

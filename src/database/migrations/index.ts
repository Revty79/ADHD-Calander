import { createTasksMigration } from "./001_create_tasks";
import { calendarFoundationMigration } from "./002_calendar_foundation";
import { recoveryFoundationMigration } from "./003_recovery_foundation";
import { settingsRemindersFoundationMigration } from "./004_settings_reminders_foundation";
import { schedulingAssistanceFoundationMigration } from "./005_scheduling_assistance_foundation";
import { taskFunctionalCoreMigration } from "./006_task_functional_core";
import { Migration } from "./types";

export const migrations: Migration[] = [
  createTasksMigration,
  calendarFoundationMigration,
  recoveryFoundationMigration,
  settingsRemindersFoundationMigration,
  schedulingAssistanceFoundationMigration,
  taskFunctionalCoreMigration
];

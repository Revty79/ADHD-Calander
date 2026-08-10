import { createTasksMigration } from "./001_create_tasks";
import { calendarFoundationMigration } from "./002_calendar_foundation";
import { recoveryFoundationMigration } from "./003_recovery_foundation";
import { settingsRemindersFoundationMigration } from "./004_settings_reminders_foundation";
import { schedulingAssistanceFoundationMigration } from "./005_scheduling_assistance_foundation";
import { taskFunctionalCoreMigration } from "./006_task_functional_core";
import { executionMultipleRemindersMigration } from "./007_execution_multiple_reminders";
import { plannedTimePreferencesCompatibilityMigration } from "./008_planned_time_preferences";
import { taskPreferredDeadlineTimesMigration } from "./009_task_preferred_deadline_times";
import { independentRemindersMigration } from "./010_independent_reminders";
import { Migration } from "./types";

export const migrations: Migration[] = [
  createTasksMigration,
  calendarFoundationMigration,
  recoveryFoundationMigration,
  settingsRemindersFoundationMigration,
  schedulingAssistanceFoundationMigration,
  taskFunctionalCoreMigration,
  executionMultipleRemindersMigration,
  plannedTimePreferencesCompatibilityMigration,
  taskPreferredDeadlineTimesMigration,
  independentRemindersMigration
];

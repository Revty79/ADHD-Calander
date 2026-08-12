import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DatabaseInitializationError,
  initializeDatabase
} from "../src/database/database";
import {
  TaskPersistenceError,
  TaskValidationError
} from "../src/database/repositories/errors";
import { TaskRepository } from "../src/database/repositories/taskRepository";
import { SqlExecutor } from "../src/database/sql";
import { SqlCalendarEventStorage } from "../src/database/sqlCalendarEventStorage";
import { SqlTaskStorage } from "../src/database/sqlTaskStorage";
import { createTasksMigration } from "../src/database/migrations/001_create_tasks";
import { migrations } from "../src/database/migrations";
import { ReminderSynchronizer } from "../src/notifications/reminderSynchronizer";
import { CalendarEvent } from "../src/types/calendarEvent";
import { RecoverySession } from "../src/types/recovery";
import { getTaskPlanningState, Task } from "../src/types/task";
import { getLocalDateString } from "../src/utils/dates";
import {
  getDeadlineQuickChoices,
  getPlannedDateQuickChoices
} from "../src/features/tasks/taskDateChoices";
import { createSqlJsDatabase } from "./helpers/sqlJsDatabase";

async function createRepository() {
  const database = await createSqlJsDatabase();
  await initializeDatabase(database);
  let id = 0;
  const repository = new TaskRepository(
    new SqlTaskStorage(database),
    () => `task-${++id}`,
    () => new Date("2026-08-04T14:30:00.000Z")
  );

  return { database, repository };
}

describe("task database", () => {
  it("applies the task functional core migrations", async () => {
    const database = await createSqlJsDatabase();

    await initializeDatabase(database);

    const taskTable = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks';"
    );
    const eventTable = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'calendar_events';"
    );
    const recoverySessionTable = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'recovery_sessions';"
    );
    const recoveryItemTable = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'recovery_items';"
    );
    const settingsTable = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_settings';"
    );
    const migrations = await database.getAllAsync<{ version: number; name: string }>(
      "SELECT version, name FROM schema_migrations ORDER BY version;"
    );

    assert.equal(taskTable?.name, "tasks");
    assert.equal(eventTable?.name, "calendar_events");
    assert.equal(recoverySessionTable?.name, "recovery_sessions");
    assert.equal(recoveryItemTable?.name, "recovery_items");
    assert.equal(settingsTable?.name, "app_settings");
    assert.deepEqual(migrations, [
      { version: 1, name: "create_tasks" },
      { version: 2, name: "calendar_foundation" },
      { version: 3, name: "recovery_foundation" },
      { version: 4, name: "settings_reminders_foundation" },
      { version: 5, name: "scheduling_assistance_foundation" },
      { version: 6, name: "task_functional_core" },
      { version: 7, name: "execution_multiple_reminders" },
      { version: 8, name: "planned_time_preferences" },
      { version: 9, name: "task_preferred_deadline_times" },
      { version: 10, name: "independent_reminders" },
      { version: 11, name: "calendar_colors_recurrence" }
    ]);

    const taskColumns = await database.getAllAsync<{ name: string }>(
      "PRAGMA table_info(tasks);"
    );
    assert.ok(taskColumns.some((column) => column.name === "importance"));
    assert.ok(taskColumns.some((column) => column.name === "parent_task_id"));
    assert.ok(taskColumns.some((column) => column.name === "started_at"));
    assert.ok(taskColumns.some((column) => column.name === "reminder_offsets"));
    assert.ok(taskColumns.some((column) => column.name === "color"));
    assert.ok(taskColumns.some((column) => column.name === "planned_time_preference"));
    assert.ok(taskColumns.some((column) => column.name === "preferred_time"));
    assert.ok(taskColumns.some((column) => column.name === "deadline_time"));
    assert.ok(taskColumns.some((column) => column.name === "reminders"));
    const recoveryItemColumns = await database.getAllAsync<{ name: string }>(
      "PRAGMA table_info(recovery_items);"
    );
    assert.ok(
      recoveryItemColumns.some(
        (column) => column.name === "original_planned_time_preference"
      )
    );
    assert.ok(
      recoveryItemColumns.some((column) => column.name === "original_preferred_time")
    );
    assert.ok(recoveryItemColumns.some((column) => column.name === "original_reminders"));
  });

  it("opens a database with migration eight applied without changing records", async () => {
    const database = await createSqlJsDatabase();
    await database.execAsync(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    for (const migration of migrations.filter((candidate) => candidate.version <= 8)) {
      await migration.up(database);
      await database.runAsync(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);",
        migration.version,
        migration.name,
        "2026-08-07T14:00:00.000Z"
      );
    }
    const existingTask: Task = {
      id: "migration-eight-task",
      title: "Existing completed task",
      description: "Keep native history",
      importance: "important",
      color: "neutral",
      status: "completed",
      parentTaskId: null,
      scheduledDate: "2026-08-08",
      scheduledTime: "09:30",
      preferredTime: null,
      estimatedDurationMinutes: 45,
      deadlineDate: "2026-08-09",
      deadlineTime: null,
      reminders: [
        { kind: "relative", offsetMinutes: 60 },
        { kind: "relative", offsetMinutes: 15 }
      ],
      reminderOffsets: [60, 15],
      startedAt: "2026-08-08T15:00:00.000Z",
      createdAt: "2026-08-07T14:00:00.000Z",
      updatedAt: "2026-08-08T16:00:00.000Z",
      completedAt: "2026-08-08T16:00:00.000Z",
      deletedAt: null
    };
    const existingEvent: CalendarEvent = {
      id: "migration-eight-event",
      title: "Existing fixed commitment",
      kind: "fixed",
      date: "2026-08-08",
      startTime: "11:00",
      endTime: null,
      durationMinutes: 30,
      notes: "Keep native event",
      color: "neutral",
      reminders: [{ kind: "relative", offsetMinutes: 30 }],
      reminderOffsets: [30],
      recurrence: null,
      createdAt: "2026-08-07T14:00:00.000Z",
      updatedAt: "2026-08-07T14:00:00.000Z"
    };
    const existingRecoverySession: RecoverySession = {
      id: "migration-eight-recovery-session",
      sourceDate: "2026-08-08",
      status: "completed",
      startedAt: "2026-08-08T17:00:00.000Z",
      completedAt: "2026-08-08T17:05:00.000Z",
      items: [
        {
          id: "migration-eight-recovery-item",
          sessionId: "migration-eight-recovery-session",
          taskId: existingTask.id,
          originalTitle: existingTask.title,
          originalStatus: "not_started",
          originalScheduledDate: "2026-08-08",
          originalScheduledTime: "09:30",
          originalPreferredTime: null,
          originalEstimatedDurationMinutes: 45,
          originalReminders: [
            { kind: "relative", offsetMinutes: 60 },
            { kind: "relative", offsetMinutes: 15 }
          ],
          originalReminderOffsets: [60, 15],
          status: "resolved",
          decision: "keep",
          note: null,
          rescheduledDate: null,
          rescheduledTime: null,
          createdTaskIds: [],
          reviewedAt: "2026-08-08T17:00:00.000Z",
          createdAt: "2026-08-08T17:00:00.000Z",
          updatedAt: "2026-08-08T17:00:00.000Z"
        }
      ]
    };

    await database.runAsync(
      `
        INSERT INTO tasks (
          id, title, description, importance, status, parent_task_id,
          scheduled_date, scheduled_time, estimated_duration_minutes,
          deadline_date, reminder_offsets, started_at, created_at, updated_at,
          completed_at, deleted_at, planned_time_preference
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      existingTask.id,
      existingTask.title,
      existingTask.description,
      existingTask.importance,
      existingTask.status,
      existingTask.parentTaskId,
      existingTask.scheduledDate,
      existingTask.scheduledTime,
      existingTask.estimatedDurationMinutes,
      existingTask.deadlineDate,
      JSON.stringify(existingTask.reminderOffsets),
      existingTask.startedAt,
      existingTask.createdAt,
      existingTask.updatedAt,
      existingTask.completedAt,
      existingTask.deletedAt,
      "morning"
    );
    await database.runAsync(
      `
        INSERT INTO calendar_events (
          id, title, kind, date, start_time, end_time, duration_minutes,
          notes, reminder_offsets, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      existingEvent.id,
      existingEvent.title,
      existingEvent.kind,
      existingEvent.date,
      existingEvent.startTime,
      existingEvent.endTime,
      existingEvent.durationMinutes,
      existingEvent.notes,
      JSON.stringify(existingEvent.reminderOffsets),
      existingEvent.createdAt,
      existingEvent.updatedAt
    );
    await database.runAsync(
      `
        INSERT INTO recovery_sessions (
          id, source_date, status, started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?);
      `,
      existingRecoverySession.id,
      existingRecoverySession.sourceDate,
      existingRecoverySession.status,
      existingRecoverySession.startedAt,
      existingRecoverySession.completedAt
    );
    const existingRecoveryItem = existingRecoverySession.items[0]!;
    await database.runAsync(
      `
        INSERT INTO recovery_items (
          id, session_id, task_id, original_title, original_status,
          original_scheduled_date, original_scheduled_time,
          original_estimated_duration_minutes, original_reminder_offsets,
          status, decision, note, rescheduled_date, rescheduled_time,
          created_task_ids, reviewed_at, created_at, updated_at,
          original_planned_time_preference
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      existingRecoveryItem.id,
      existingRecoveryItem.sessionId,
      existingRecoveryItem.taskId,
      existingRecoveryItem.originalTitle,
      existingRecoveryItem.originalStatus,
      existingRecoveryItem.originalScheduledDate,
      existingRecoveryItem.originalScheduledTime,
      existingRecoveryItem.originalEstimatedDurationMinutes,
      JSON.stringify(existingRecoveryItem.originalReminderOffsets),
      existingRecoveryItem.status,
      existingRecoveryItem.decision,
      existingRecoveryItem.note,
      existingRecoveryItem.rescheduledDate,
      existingRecoveryItem.rescheduledTime,
      JSON.stringify(existingRecoveryItem.createdTaskIds),
      existingRecoveryItem.reviewedAt,
      existingRecoveryItem.createdAt,
      existingRecoveryItem.updatedAt,
      "morning"
    );

    for (const [key, value] of [
      ["reminders_enabled", "true"],
      ["planning_day_start", "07:00"],
      ["transition_buffer_minutes", "30"]
    ] as const) {
      await database.runAsync(
        "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);",
        key,
        value,
        "2026-08-07T14:00:00.000Z"
      );
    }

    const reopenedDatabase = await createSqlJsDatabase(database.exportData());
    const beforeOpen = await readCompatibilitySnapshot(reopenedDatabase);

    await initializeDatabase(reopenedDatabase);

    assert.deepEqual(await readCompatibilitySnapshot(reopenedDatabase), beforeOpen);
    assert.deepEqual(
      await reopenedDatabase.getFirstAsync<{ version: number; name: string }>(
        "SELECT version, name FROM schema_migrations WHERE version = 10;"
      ),
      { version: 10, name: "independent_reminders" }
    );
    const openedTask = await new TaskRepository(
      new SqlTaskStorage(reopenedDatabase)
    ).getTaskById(existingTask.id);
    assert.deepEqual(openedTask, existingTask);
    assert.equal(openedTask && "plannedTimePreference" in openedTask, false);
    assert.deepEqual(
      [
        getTaskPlanningState({
          ...existingTask,
          scheduledDate: null,
          scheduledTime: null
        }),
        getTaskPlanningState({ ...existingTask, scheduledTime: null }),
        getTaskPlanningState(existingTask)
      ],
      ["flexible", "planned", "scheduled"]
    );
  });

  it("opens a database with migration nine applied and preserves reminder intent", async () => {
    const database = await createSqlJsDatabase();
    await database.execAsync(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    for (const migration of migrations.filter((candidate) => candidate.version <= 9)) {
      await migration.up(database);
      await database.runAsync(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);",
        migration.version,
        migration.name,
        "2026-08-09T14:00:00.000Z"
      );
    }

    await database.runAsync(
      `
        INSERT INTO tasks (
          id, title, description, importance, status, parent_task_id,
          scheduled_date, scheduled_time, preferred_time,
          estimated_duration_minutes, deadline_date, deadline_time,
          reminder_offsets, started_at, created_at, updated_at,
          completed_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      "migration-nine-task",
      "Existing version nine task",
      "Preserve native data",
      "important",
      "started",
      null,
      "2026-08-11",
      "14:30",
      null,
      45,
      "2026-08-12",
      "17:00",
      "[60,15]",
      "2026-08-09T20:00:00.000Z",
      "2026-08-09T14:00:00.000Z",
      "2026-08-09T20:00:00.000Z",
      null,
      null
    );
    const preservedColumns = `
      SELECT
        id, title, description, importance, status, parent_task_id,
        scheduled_date, scheduled_time, preferred_time,
        estimated_duration_minutes, deadline_date, deadline_time,
        reminder_offsets, started_at, created_at, updated_at,
        completed_at, deleted_at
      FROM tasks
      WHERE id = 'migration-nine-task';
    `;
    const beforeOpen =
      await database.getFirstAsync<Record<string, unknown>>(preservedColumns);

    await initializeDatabase(database);

    assert.deepEqual(
      await database.getFirstAsync<Record<string, unknown>>(preservedColumns),
      beforeOpen
    );
    assert.deepEqual(
      await database.getFirstAsync<{ version: number; name: string }>(
        "SELECT version, name FROM schema_migrations WHERE version = 10;"
      ),
      { version: 10, name: "independent_reminders" }
    );
    assert.deepEqual(
      (await new SqlTaskStorage(database).getTaskById("migration-nine-task"))?.reminders,
      [
        { kind: "relative", offsetMinutes: 60 },
        { kind: "relative", offsetMinutes: 15 }
      ]
    );
  });

  it("preserves existing tasks when upgrading to calendar storage", async () => {
    const database = await createSqlJsDatabase();
    await database.execAsync(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
    await createTasksMigration.up(database);
    await database.runAsync(
      "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);",
      1,
      "create_tasks",
      "2026-08-04T14:30:00.000Z"
    );
    await database.runAsync(
      `
        INSERT INTO tasks (
          id, title, description, status, scheduled_date, scheduled_time,
          created_at, updated_at, completed_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      "legacy-task",
      "Existing task",
      null,
      "not_started",
      "2026-08-06",
      "09:00",
      "2026-08-04T14:30:00.000Z",
      "2026-08-04T14:30:00.000Z",
      null,
      null
    );

    await initializeDatabase(database);

    const repository = new TaskRepository(new SqlTaskStorage(database));
    const tasks = await repository.getAllTasks();

    assert.equal(tasks[0]?.title, "Existing task");
    assert.equal(tasks[0]?.scheduledDate, "2026-08-06");
    assert.equal(tasks[0]?.estimatedDurationMinutes, null);
    assert.equal(tasks[0]?.deadlineDate, null);
    assert.deepEqual(tasks[0]?.reminderOffsets, []);
    assert.equal(tasks[0]?.startedAt, null);
    assert.equal(tasks[0]?.importance, "normal");
    assert.equal(tasks[0]?.parentTaskId, null);
  });

  it("migrates legacy single reminders without changing installed data", async () => {
    const database = await createSqlJsDatabase();
    await database.execAsync(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    for (const migration of migrations.filter((candidate) => candidate.version <= 6)) {
      await migration.up(database);
      await database.runAsync(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);",
        migration.version,
        migration.name,
        "2026-08-04T14:30:00.000Z"
      );
    }

    await database.runAsync(
      `
        INSERT INTO tasks (
          id, title, description, status, scheduled_date, scheduled_time,
          estimated_duration_minutes, created_at, updated_at, completed_at,
          deleted_at, reminder_offset_minutes, deadline_date, importance,
          parent_task_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      "legacy-reminder-task",
      "Existing reminded task",
      null,
      "not_started",
      "2026-08-06",
      "09:00",
      30,
      "2026-08-04T14:30:00.000Z",
      "2026-08-04T14:30:00.000Z",
      null,
      null,
      30,
      null,
      "normal",
      null
    );
    await database.runAsync(
      `
        INSERT INTO calendar_events (
          id, title, kind, date, start_time, end_time, duration_minutes,
          notes, created_at, updated_at, reminder_offset_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      "legacy-reminder-event",
      "Existing reminded event",
      "fixed",
      "2026-08-06",
      "11:00",
      null,
      30,
      null,
      "2026-08-04T14:30:00.000Z",
      "2026-08-04T14:30:00.000Z",
      60
    );

    await initializeDatabase(database);

    assert.deepEqual(
      (await new SqlTaskStorage(database).getTaskById("legacy-reminder-task"))
        ?.reminderOffsets,
      [30]
    );
    assert.deepEqual(
      (await new SqlCalendarEventStorage(database).getAllEvents())[0]?.reminderOffsets,
      [60]
    );
  });

  it("creates a task with normalized input", async () => {
    const { repository } = await createRepository();

    const task = await repository.createTask({
      title: "  Pay electric bill  ",
      description: "  Use checking account  ",
      scheduledDate: "2026-08-04",
      scheduledTime: "09:15",
      estimatedDurationMinutes: 25,
      deadlineDate: "2026-08-08"
    });

    assert.equal(task.id, "task-1");
    assert.equal(task.title, "Pay electric bill");
    assert.equal(task.description, "Use checking account");
    assert.equal(task.importance, "normal");
    assert.equal(task.status, "not_started");
    assert.equal(task.scheduledDate, "2026-08-04");
    assert.equal(task.scheduledTime, "09:15");
    assert.equal(task.estimatedDurationMinutes, 25);
    assert.equal(task.deadlineDate, "2026-08-08");
    assert.deepEqual(task.reminderOffsets, []);
    assert.equal(task.startedAt, null);
    assert.equal(task.completedAt, null);
    assert.equal(task.deletedAt, null);
  });

  it("edits one task identity across planning states and persists the changes", async () => {
    const { database, repository } = await createRepository();
    const original = await repository.createTask({ title: "Draft outline" });

    const planned = await repository.updateTask(original.id, {
      title: "Draft project outline",
      description: "Start with the three main sections",
      importance: "important",
      scheduledDate: "2026-08-06",
      preferredTime: "09:30",
      estimatedDurationMinutes: 45,
      deadlineDate: "2026-08-08",
      deadlineTime: "16:00",
      reminders: [{ kind: "absolute", date: "2026-08-07", time: "12:00" }]
    });

    assert.equal(planned.id, original.id);
    assert.equal(planned.scheduledDate, "2026-08-06");
    assert.equal(planned.scheduledTime, null);
    assert.equal(planned.preferredTime, "09:30");
    assert.equal(getTaskPlanningState(planned), "planned");
    assert.equal(planned.importance, "important");
    assert.equal((await repository.getAllTasks()).length, 1);

    const scheduled = await repository.updateTask(original.id, {
      ...planned,
      scheduledDate: "2026-08-06",
      scheduledTime: "10:00",
      preferredTime: null,
      reminders: [
        { kind: "relative", offsetMinutes: 10 },
        { kind: "absolute", date: "2026-08-07", time: "12:00" }
      ]
    });
    assert.equal(scheduled.scheduledTime, "10:00");
    assert.equal(scheduled.preferredTime, null);
    assert.equal(getTaskPlanningState(scheduled), "scheduled");
    assert.deepEqual(scheduled.reminderOffsets, [10]);
    assert.equal(scheduled.reminders.length, 2);

    const replanned = await repository.updateTask(original.id, {
      ...scheduled,
      scheduledTime: null,
      preferredTime: scheduled.scheduledTime
    });
    assert.equal(replanned.scheduledTime, null);
    assert.equal(replanned.preferredTime, "10:00");
    assert.equal(getTaskPlanningState(replanned), "planned");

    const flexible = await repository.updateTask(original.id, {
      ...replanned,
      scheduledDate: null,
      scheduledTime: null,
      preferredTime: null,
      reminders: replanned.reminders
    });
    assert.equal(flexible.scheduledDate, null);
    assert.equal(flexible.scheduledTime, null);
    assert.equal(flexible.preferredTime, null);
    assert.equal(getTaskPlanningState(flexible), "flexible");
    assert.deepEqual(flexible.reminderOffsets, [10]);
    assert.deepEqual(flexible.reminders, scheduled.reminders);

    const restoredDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(restoredDatabase);
    const restoredTask = await new TaskRepository(
      new SqlTaskStorage(restoredDatabase)
    ).getTaskById(original.id);
    assert.equal(restoredTask.title, "Draft project outline");
    assert.equal(restoredTask.importance, "important");
    assert.equal(restoredTask.scheduledDate, null);
    assert.equal(restoredTask.preferredTime, null);
    assert.equal(restoredTask.deadlineDate, "2026-08-08");
    assert.equal(restoredTask.deadlineTime, "16:00");
    assert.deepEqual(restoredTask.reminders, scheduled.reminders);
    assert.equal(restoredTask.id, original.id);
  });

  it("persists and clears optional preferred and deadline times", async () => {
    const { database, repository } = await createRepository();
    const task = await repository.createTask({
      title: "Prepare the packet",
      scheduledDate: "2026-08-08",
      preferredTime: "14:00",
      deadlineDate: "2026-08-09",
      deadlineTime: "15:30"
    });

    assert.equal(getTaskPlanningState(task), "planned");
    assert.equal(task.preferredTime, "14:00");
    assert.equal(task.deadlineTime, "15:30");

    const withoutTimes = await repository.updateTask(task.id, {
      ...task,
      preferredTime: null,
      deadlineTime: null
    });
    assert.equal(withoutTimes.id, task.id);
    assert.equal(getTaskPlanningState(withoutTimes), "planned");
    assert.equal(withoutTimes.preferredTime, null);
    assert.equal(withoutTimes.deadlineDate, "2026-08-09");
    assert.equal(withoutTimes.deadlineTime, null);

    const withoutDeadline = await repository.updateTask(task.id, {
      ...withoutTimes,
      deadlineDate: null,
      deadlineTime: null
    });
    assert.equal(withoutDeadline.deadlineDate, null);
    assert.equal(withoutDeadline.deadlineTime, null);

    const restoredDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(restoredDatabase);
    const restoredTask = await new TaskRepository(
      new SqlTaskStorage(restoredDatabase)
    ).getTaskById(task.id);

    assert.equal(restoredTask.id, task.id);
    assert.equal(restoredTask.scheduledDate, "2026-08-08");
    assert.equal(restoredTask.preferredTime, null);
    assert.equal(restoredTask.deadlineDate, null);
    assert.equal(restoredTask.deadlineTime, null);
  });

  it("preserves reminder choices when an edited schedule moves into the past", async () => {
    const database = await createSqlJsDatabase();
    await initializeDatabase(database);
    const synchronizer = new RecordingTaskReminderSynchronizer();
    const repository = new TaskRepository(
      new SqlTaskStorage(database),
      () => "reminded-task",
      () => new Date(2026, 7, 4, 12, 0, 0),
      synchronizer
    );
    const task = await repository.createTask({
      title: "Prepare notes",
      scheduledDate: "2026-08-06",
      scheduledTime: "10:00",
      reminderOffsets: [10]
    });

    const edited = await repository.updateTask(task.id, {
      ...task,
      scheduledDate: "2026-08-04",
      scheduledTime: "09:00",
      reminderOffsets: [10]
    });

    assert.deepEqual(edited.reminderOffsets, [10]);
    assert.deepEqual(synchronizer.tasks.at(-1)?.reminderOffsets, [10]);
  });

  it("breaks down a task with persisted parent relationships and reversible children", async () => {
    const { database, repository } = await createRepository();
    const parent = await repository.createTask({
      title: "Prepare presentation",
      importance: "important",
      scheduledDate: "2026-08-06"
    });

    const children = await repository.breakDownTask(parent.id, {
      titles: ["Choose examples", "Draft slides"]
    });
    assert.equal((await repository.getTaskById(parent.id)).status, "broken_down");
    assert.ok(children.every((child) => child.parentTaskId === parent.id));
    assert.ok(children.every((child) => child.scheduledDate === null));
    assert.deepEqual(
      (await repository.getChildTasks(parent.id)).map((task) => task.title),
      ["Choose examples", "Draft slides"]
    );

    const restoredDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(restoredDatabase);
    const restoredRepository = new TaskRepository(new SqlTaskStorage(restoredDatabase));
    assert.equal((await restoredRepository.getChildTasks(parent.id)).length, 2);

    const restoredParent = await restoredRepository.undoTaskBreakdown(parent.id);
    assert.equal(restoredParent.status, "not_started");
    assert.ok(
      (await restoredRepository.getChildTasks(parent.id)).every(
        (child) => child.status === "removed"
      )
    );
  });

  it("protects completed smaller tasks when undoing a breakdown", async () => {
    const { repository } = await createRepository();
    const parent = await repository.createTask({ title: "Organize records" });
    const [firstChild] = await repository.breakDownTask(parent.id, {
      titles: ["Collect records", "File records"]
    });
    await repository.completeTask(firstChild!.id);

    await assert.rejects(
      () => repository.undoTaskBreakdown(parent.id),
      (error) => error instanceof TaskValidationError && error.field === "breakdownTitles"
    );
  });

  it("removes and restores an active task without deleting its history", async () => {
    const { repository } = await createRepository();
    const task = await repository.createTask({ title: "Optional errand" });

    const removed = await repository.removeTask(task.id);
    assert.equal(removed.status, "removed");
    assert.equal((await repository.getAllTasks()).length, 1);

    const restored = await repository.restoreTask(task.id);
    assert.equal(restored.id, task.id);
    assert.equal(restored.status, "not_started");
  });

  it("creates and persists an unscheduled task", async () => {
    const { database, repository } = await createRepository();
    const task = await repository.createTask({ title: "Sort paperwork" });

    assert.equal(task.scheduledDate, null);
    assert.equal(task.scheduledTime, null);

    const restoredDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(restoredDatabase);
    const restoredRepository = new TaskRepository(new SqlTaskStorage(restoredDatabase));

    assert.equal((await restoredRepository.getAllTasks())[0]?.scheduledDate, null);
  });

  it("requires a date before a task time", async () => {
    const { repository } = await createRepository();

    await assert.rejects(
      () => repository.createTask({ title: "Timed task", scheduledTime: "10:00" }),
      (error) => {
        assert.ok(error instanceof TaskValidationError);
        assert.equal(error.field, "scheduledDate");

        return true;
      }
    );

    await assert.rejects(
      () => repository.createTask({ title: "Preferred task", preferredTime: "10:00" }),
      (error) => error instanceof TaskValidationError && error.field === "preferredTime"
    );
  });

  it("keeps a deadline distinct and validates its local date and time", async () => {
    const { repository } = await createRepository();

    await assert.rejects(
      () =>
        repository.createTask({
          title: "Impossible plan",
          scheduledDate: "2026-08-08",
          deadlineDate: "2026-08-07"
        }),
      (error) => error instanceof TaskValidationError && error.field === "deadlineDate"
    );

    await assert.rejects(
      () =>
        repository.createTask({ title: "Missing deadline date", deadlineTime: "15:30" }),
      (error) => error instanceof TaskValidationError && error.field === "deadlineTime"
    );

    const task = await repository.createTask({
      title: "Possible plan",
      scheduledDate: "2026-08-08",
      deadlineDate: "2026-08-08",
      deadlineTime: "23:59"
    });

    assert.equal(task.scheduledDate, "2026-08-08");
    assert.equal(task.deadlineDate, "2026-08-08");
    assert.equal(task.deadlineTime, "23:59");
  });

  it("requires scheduled work to finish by an exact or end-of-day deadline", async () => {
    const { repository } = await createRepository();

    const exactFit = await repository.createTask({
      title: "Exact deadline fit",
      scheduledDate: "2026-08-08",
      scheduledTime: "15:00",
      estimatedDurationMinutes: 30,
      deadlineDate: "2026-08-08",
      deadlineTime: "15:30"
    });
    assert.equal(exactFit.scheduledTime, "15:00");

    await assert.rejects(
      () =>
        repository.createTask({
          title: "Past exact deadline",
          scheduledDate: "2026-08-08",
          scheduledTime: "15:01",
          estimatedDurationMinutes: 30,
          deadlineDate: "2026-08-08",
          deadlineTime: "15:30"
        }),
      (error) => error instanceof TaskValidationError && error.field === "deadlineTime"
    );

    const endOfDayFit = await repository.createTask({
      title: "End of day fit",
      scheduledDate: "2026-08-08",
      scheduledTime: "23:30",
      estimatedDurationMinutes: 30,
      deadlineDate: "2026-08-08"
    });
    assert.equal(endOfDayFit.deadlineTime, null);

    await assert.rejects(
      () =>
        repository.createTask({
          title: "Past end of day",
          scheduledDate: "2026-08-08",
          scheduledTime: "23:30",
          estimatedDurationMinutes: 31,
          deadlineDate: "2026-08-08"
        }),
      (error) => error instanceof TaskValidationError && error.field === "deadlineDate"
    );
  });

  it("retrieves tasks for a date without returning other days", async () => {
    const { repository } = await createRepository();
    await repository.createTask({
      title: "Today task",
      scheduledDate: "2026-08-04"
    });
    await repository.createTask({
      title: "Tomorrow task",
      scheduledDate: "2026-08-05"
    });

    const tasks = await repository.getTasksForDate("2026-08-04");

    assert.deepEqual(
      tasks.map((task) => task.title),
      ["Today task"]
    );
  });

  it("completes a task", async () => {
    const { repository } = await createRepository();
    const task = await repository.createTask({
      title: "Finish intake form",
      scheduledDate: "2026-08-04"
    });

    const completedTask = await repository.completeTask(task.id);

    assert.equal(completedTask.status, "completed");
    assert.equal(completedTask.completedAt, "2026-08-04T14:30:00.000Z");
  });

  it("starts and pauses a task with persisted execution state", async () => {
    const { database, repository } = await createRepository();
    const task = await repository.createTask({ title: "Read the brief" });

    const started = await repository.startTask(task.id);
    assert.equal(started.status, "started");
    assert.equal(started.startedAt, "2026-08-04T14:30:00.000Z");

    let reopenedDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(reopenedDatabase);
    let reopenedRepository = new TaskRepository(new SqlTaskStorage(reopenedDatabase));
    assert.equal((await reopenedRepository.getTaskById(task.id)).status, "started");

    const paused = await reopenedRepository.pauseTask(task.id);
    assert.equal(paused.status, "not_started");
    assert.equal(paused.startedAt, "2026-08-04T14:30:00.000Z");

    reopenedDatabase = await createSqlJsDatabase(reopenedDatabase.exportData());
    await initializeDatabase(reopenedDatabase);
    reopenedRepository = new TaskRepository(new SqlTaskStorage(reopenedDatabase));
    assert.equal((await reopenedRepository.getTaskById(task.id)).status, "not_started");
  });

  it("completes an in-progress task and undoes to a calm unfinished state", async () => {
    const { repository } = await createRepository();
    const task = await repository.createTask({ title: "Finish the summary" });
    await repository.startTask(task.id);

    const completed = await repository.completeTask(task.id);
    assert.equal(completed.status, "completed");
    assert.equal(completed.completedAt, "2026-08-04T14:30:00.000Z");
    assert.equal(completed.startedAt, "2026-08-04T14:30:00.000Z");

    const undone = await repository.undoTaskCompletion(task.id);
    assert.equal(undone.status, "not_started");
    assert.equal(undone.completedAt, null);
    assert.equal(undone.startedAt, "2026-08-04T14:30:00.000Z");
  });

  it("undoes task completion", async () => {
    const { repository } = await createRepository();
    const task = await repository.createTask({
      title: "Start laundry",
      scheduledDate: "2026-08-04"
    });

    await repository.completeTask(task.id);
    const restoredTask = await repository.undoTaskCompletion(task.id);

    assert.equal(restoredTask.status, "not_started");
    assert.equal(restoredTask.completedAt, null);
  });

  it("records a new completion time after completion is undone", async () => {
    const database = await createSqlJsDatabase();
    await initializeDatabase(database);
    let currentTime = new Date("2026-08-04T14:30:00.000Z");
    const repository = new TaskRepository(
      new SqlTaskStorage(database),
      () => "recompleted-task",
      () => currentTime
    );
    const task = await repository.createTask({ title: "Try this again" });
    currentTime = new Date("2026-08-04T15:00:00.000Z");
    const firstCompletion = await repository.completeTask(task.id);
    currentTime = new Date("2026-08-04T15:30:00.000Z");
    const undone = await repository.undoTaskCompletion(task.id);
    currentTime = new Date("2026-08-04T16:00:00.000Z");
    const secondCompletion = await repository.completeTask(task.id);

    assert.equal(firstCompletion.completedAt, "2026-08-04T15:00:00.000Z");
    assert.equal(undone.completedAt, null);
    assert.equal(secondCompletion.completedAt, "2026-08-04T16:00:00.000Z");
  });

  it("persists tasks through repository and database reinitialization", async () => {
    const { database, repository } = await createRepository();
    await repository.createTask({
      title: "Pack work bag",
      scheduledDate: "2026-08-04"
    });

    const exportedData = database.exportData();
    const restoredDatabase = await createSqlJsDatabase(exportedData);
    await initializeDatabase(restoredDatabase);
    const restoredRepository = new TaskRepository(new SqlTaskStorage(restoredDatabase));

    const tasks = await restoredRepository.getTasksForDate("2026-08-04");

    assert.deepEqual(
      tasks.map((task) => task.title),
      ["Pack work bag"]
    );
  });

  it("rejects an empty title", async () => {
    const { repository } = await createRepository();

    await assert.rejects(
      async () =>
        repository.createTask({
          title: "   ",
          scheduledDate: "2026-08-04"
        }),
      (error) => {
        assert.ok(error instanceof TaskValidationError);
        assert.equal(error.field, "title");

        return true;
      }
    );
  });

  it("handles local dates without shifting through UTC conversion", () => {
    const lateLocalDate = new Date(2026, 0, 5, 23, 45);

    assert.equal(getLocalDateString(lateLocalDate), "2026-01-05");
  });

  it("resolves task date quick choices from local calendar days", () => {
    const reference = new Date(2026, 0, 31, 23, 45);

    assert.deepEqual(
      getPlannedDateQuickChoices(reference).map((choice) => choice.value),
      ["2026-01-31", "2026-02-01"]
    );
    assert.deepEqual(
      getDeadlineQuickChoices(reference).map((choice) => choice.value),
      [null, "2026-01-31", "2026-02-01", "2026-02-03", "2026-02-07"]
    );
  });

  it("wraps database write errors", async () => {
    const failingDatabase: SqlExecutor = {
      execAsync: async () => undefined,
      runAsync: async () => {
        throw new Error("database is locked");
      },
      getAllAsync: async () => [],
      getFirstAsync: async () => null
    };
    const repository = new TaskRepository(new SqlTaskStorage(failingDatabase));

    await assert.rejects(
      async () =>
        repository.createTask({
          title: "Save this",
          scheduledDate: "2026-08-04"
        }),
      TaskPersistenceError
    );
  });

  it("wraps database initialization errors", async () => {
    const failingDatabase: SqlExecutor = {
      execAsync: async () => {
        throw new Error("cannot open database");
      },
      runAsync: async () => ({ changes: 0 }),
      getAllAsync: async () => [],
      getFirstAsync: async () => null
    };

    await assert.rejects(
      async () => initializeDatabase(failingDatabase),
      DatabaseInitializationError
    );
  });
});

async function readCompatibilitySnapshot(database: SqlExecutor) {
  return {
    migrations: await database.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM schema_migrations WHERE version <= 8 ORDER BY version;"
    ),
    tasks: await database.getAllAsync<Record<string, unknown>>(
      `
        SELECT
          id, title, description, importance, status, parent_task_id,
          scheduled_date, scheduled_time, estimated_duration_minutes,
          deadline_date, reminder_offset_minutes, reminder_offsets, started_at,
          created_at, updated_at, completed_at, deleted_at,
          planned_time_preference
        FROM tasks
        ORDER BY id;
      `
    ),
    calendarEvents: await database.getAllAsync<Record<string, unknown>>(
      `
        SELECT
          id, title, kind, date, start_time, end_time, duration_minutes,
          notes, reminder_offset_minutes, reminder_offsets, created_at, updated_at
        FROM calendar_events
        ORDER BY id;
      `
    ),
    recoverySessions: await database.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM recovery_sessions ORDER BY id;"
    ),
    recoveryItems: await database.getAllAsync<Record<string, unknown>>(
      `
        SELECT
          id, session_id, task_id, original_title, original_status,
          original_scheduled_date, original_scheduled_time,
          original_estimated_duration_minutes, original_reminder_offset_minutes,
          original_reminder_offsets, status, decision, note, rescheduled_date,
          rescheduled_time, created_task_ids, reviewed_at, created_at, updated_at,
          original_planned_time_preference
        FROM recovery_items
        ORDER BY id;
      `
    ),
    settings: await database.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM app_settings ORDER BY key;"
    )
  };
}

class RecordingTaskReminderSynchronizer implements ReminderSynchronizer {
  readonly tasks: Task[] = [];

  async syncTaskReminder(task: Task) {
    this.tasks.push({ ...task });
  }

  async syncEventReminder() {}
}

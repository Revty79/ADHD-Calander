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
import { SqlTaskStorage } from "../src/database/sqlTaskStorage";
import { SqlCalendarEventStorage } from "../src/database/sqlCalendarEventStorage";
import { createTasksMigration } from "../src/database/migrations/001_create_tasks";
import { migrations } from "../src/database/migrations";
import { ReminderSynchronizer } from "../src/notifications/reminderSynchronizer";
import { getTaskPlanningState, PlannedTimePreference, Task } from "../src/types/task";
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
      { version: 8, name: "planned_time_preferences" }
    ]);

    const taskColumns = await database.getAllAsync<{ name: string }>(
      "PRAGMA table_info(tasks);"
    );
    assert.ok(taskColumns.some((column) => column.name === "importance"));
    assert.ok(taskColumns.some((column) => column.name === "parent_task_id"));
    assert.ok(taskColumns.some((column) => column.name === "started_at"));
    assert.ok(taskColumns.some((column) => column.name === "reminder_offsets"));
    assert.ok(taskColumns.some((column) => column.name === "planned_time_preference"));
    const recoveryItemColumns = await database.getAllAsync<{ name: string }>(
      "PRAGMA table_info(recovery_items);"
    );
    assert.ok(
      recoveryItemColumns.some(
        (column) => column.name === "original_planned_time_preference"
      )
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
    assert.equal(tasks[0]?.plannedTimePreference, "anytime");
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
    assert.equal(task.plannedTimePreference, "anytime");
    assert.equal(task.estimatedDurationMinutes, 25);
    assert.equal(task.deadlineDate, "2026-08-08");
    assert.deepEqual(task.reminderOffsets, []);
    assert.equal(task.startedAt, null);
    assert.equal(task.completedAt, null);
    assert.equal(task.deletedAt, null);
  });

  it("persists every planned time preference without creating an exact time", async () => {
    const { database, repository } = await createRepository();
    const preferences: PlannedTimePreference[] = [
      "anytime",
      "morning",
      "afternoon",
      "evening"
    ];

    for (const preference of preferences) {
      const task = await repository.createTask({
        title: `${preference} task`,
        scheduledDate: "2026-08-06",
        plannedTimePreference: preference
      });

      assert.equal(task.plannedTimePreference, preference);
      assert.equal(task.scheduledTime, null);
      assert.equal(getTaskPlanningState(task), "planned");
    }

    const restoredDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(restoredDatabase);
    const restoredPreferences = (
      await new TaskRepository(new SqlTaskStorage(restoredDatabase)).getAllTasks()
    ).map((task) => task.plannedTimePreference);

    assert.deepEqual(restoredPreferences, preferences);
  });

  it("edits one task identity across planning states and persists the changes", async () => {
    const { database, repository } = await createRepository();
    const original = await repository.createTask({ title: "Draft outline" });

    const planned = await repository.updateTask(original.id, {
      title: "Draft project outline",
      description: "Start with the three main sections",
      importance: "important",
      scheduledDate: "2026-08-06",
      plannedTimePreference: "afternoon",
      estimatedDurationMinutes: 45,
      deadlineDate: "2026-08-08"
    });

    assert.equal(planned.id, original.id);
    assert.equal(planned.scheduledDate, "2026-08-06");
    assert.equal(planned.scheduledTime, null);
    assert.equal(planned.plannedTimePreference, "afternoon");
    assert.equal(getTaskPlanningState(planned), "planned");
    assert.equal(planned.importance, "important");
    assert.equal((await repository.getAllTasks()).length, 1);

    const scheduled = await repository.updateTask(original.id, {
      ...planned,
      scheduledDate: "2026-08-06",
      scheduledTime: "10:00",
      reminderOffsets: [10]
    });
    assert.equal(scheduled.scheduledTime, "10:00");
    assert.equal(scheduled.plannedTimePreference, "afternoon");
    assert.equal(getTaskPlanningState(scheduled), "scheduled");
    assert.deepEqual(scheduled.reminderOffsets, [10]);

    const replanned = await repository.updateTask(original.id, {
      ...scheduled,
      scheduledTime: null,
      plannedTimePreference: "morning"
    });
    assert.equal(replanned.id, original.id);
    assert.equal(replanned.scheduledTime, null);
    assert.equal(replanned.plannedTimePreference, "morning");
    assert.equal(getTaskPlanningState(replanned), "planned");

    const flexible = await repository.updateTask(original.id, {
      ...replanned,
      scheduledDate: null,
      scheduledTime: null,
      reminderOffsets: replanned.reminderOffsets
    });
    assert.equal(flexible.scheduledDate, null);
    assert.equal(flexible.scheduledTime, null);
    assert.equal(flexible.plannedTimePreference, null);
    assert.equal(getTaskPlanningState(flexible), "flexible");
    assert.deepEqual(flexible.reminderOffsets, [10]);

    const restoredDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(restoredDatabase);
    const restoredTask = await new TaskRepository(
      new SqlTaskStorage(restoredDatabase)
    ).getTaskById(original.id);
    assert.equal(restoredTask.title, "Draft project outline");
    assert.equal(restoredTask.importance, "important");
    assert.equal(restoredTask.scheduledDate, null);
    assert.equal(restoredTask.plannedTimePreference, null);
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
  });

  it("keeps a deadline distinct and not earlier than a planned date", async () => {
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

    const task = await repository.createTask({
      title: "Possible plan",
      scheduledDate: "2026-08-08",
      deadlineDate: "2026-08-08"
    });

    assert.equal(task.scheduledDate, "2026-08-08");
    assert.equal(task.deadlineDate, "2026-08-08");
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

class RecordingTaskReminderSynchronizer implements ReminderSynchronizer {
  readonly tasks: Task[] = [];

  async syncTaskReminder(task: Task) {
    this.tasks.push({ ...task });
  }

  async syncEventReminder() {}
}

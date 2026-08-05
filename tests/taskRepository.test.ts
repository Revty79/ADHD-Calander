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
import { getLocalDateString } from "../src/utils/dates";
import { createSqlJsDatabase } from "./helpers/sqlJsDatabase";

async function createRepository() {
  const database = await createSqlJsDatabase();
  await initializeDatabase(database);
  let id = 0;
  const repository = new TaskRepository(
    database,
    () => `task-${++id}`,
    () => new Date("2026-08-04T14:30:00.000Z")
  );

  return { database, repository };
}

describe("task database", () => {
  it("applies the initial migration", async () => {
    const database = await createSqlJsDatabase();

    await initializeDatabase(database);

    const taskTable = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks';"
    );
    const migrations = await database.getAllAsync<{ version: number; name: string }>(
      "SELECT version, name FROM schema_migrations ORDER BY version;"
    );

    assert.equal(taskTable?.name, "tasks");
    assert.deepEqual(migrations, [{ version: 1, name: "create_tasks" }]);
  });

  it("creates a task with normalized input", async () => {
    const { repository } = await createRepository();

    const task = await repository.createTask({
      title: "  Pay electric bill  ",
      description: "  Use checking account  ",
      scheduledDate: "2026-08-04",
      scheduledTime: "09:15"
    });

    assert.equal(task.id, "task-1");
    assert.equal(task.title, "Pay electric bill");
    assert.equal(task.description, "Use checking account");
    assert.equal(task.status, "not_started");
    assert.equal(task.scheduledDate, "2026-08-04");
    assert.equal(task.scheduledTime, "09:15");
    assert.equal(task.completedAt, null);
    assert.equal(task.deletedAt, null);
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

  it("persists tasks through repository and database reinitialization", async () => {
    const { database, repository } = await createRepository();
    await repository.createTask({
      title: "Pack work bag",
      scheduledDate: "2026-08-04"
    });

    const exportedData = database.exportData();
    const restoredDatabase = await createSqlJsDatabase(exportedData);
    await initializeDatabase(restoredDatabase);
    const restoredRepository = new TaskRepository(restoredDatabase);

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

  it("wraps database write errors", async () => {
    const failingDatabase: SqlExecutor = {
      execAsync: async () => undefined,
      runAsync: async () => {
        throw new Error("database is locked");
      },
      getAllAsync: async () => [],
      getFirstAsync: async () => null
    };
    const repository = new TaskRepository(failingDatabase);

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

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { IDBFactory } from "fake-indexeddb";

import {
  deserializeTaskFromWeb,
  openIndexedDbTaskStorage,
  serializeTaskForWeb,
  WebStorageDataError,
  WebStorageInitializationError
} from "../src/database/indexedDbTaskStorage.web";
import {
  TaskPersistenceError,
  TaskValidationError
} from "../src/database/repositories/errors";
import { TaskRepository } from "../src/database/repositories/taskRepository";
import { Task } from "../src/types/task";

function createRepository(databaseName: string, indexedDB = new IDBFactory()) {
  let id = 0;

  return openIndexedDbTaskStorage({ databaseName, indexedDB }).then(
    (storage) =>
      new TaskRepository(
        storage,
        () => `web-task-${++id}`,
        () => new Date("2026-08-06T15:00:00.000Z")
      )
  );
}

describe("IndexedDB task storage", () => {
  it("initializes an empty web task store", async () => {
    const repository = await createRepository("initialization-test");

    assert.deepEqual(await repository.getAllTasks(), []);
  });

  it("creates and reads a task after storage reinitialization", async () => {
    const indexedDB = new IDBFactory();
    const firstRepository = await createRepository("persistence-test", indexedDB);
    const createdTask = await firstRepository.createTask({
      title: "  Prepare lunch  ",
      description: "  Put it by the door  ",
      scheduledDate: "2026-08-06",
      scheduledTime: "12:30"
    });

    const reopenedRepository = await createRepository("persistence-test", indexedDB);
    const tasks = await reopenedRepository.getAllTasks();

    assert.deepEqual(tasks, [createdTask]);
  });

  it("completes and undoes a stored task", async () => {
    const repository = await createRepository("completion-test");
    const task = await repository.createTask({
      title: "Send the form",
      scheduledDate: "2026-08-06"
    });

    const completedTask = await repository.completeTask(task.id);
    const restoredTask = await repository.undoTaskCompletion(task.id);

    assert.equal(completedTask.status, "completed");
    assert.equal(completedTask.completedAt, "2026-08-06T15:00:00.000Z");
    assert.equal(restoredTask.status, "not_started");
    assert.equal(restoredTask.completedAt, null);
  });

  it("retrieves only tasks for the requested local date", async () => {
    const repository = await createRepository("date-test");
    await repository.createTask({
      title: "Today task",
      scheduledDate: "2026-08-06"
    });
    await repository.createTask({
      title: "Later task",
      scheduledDate: "2026-08-07"
    });

    const tasks = await repository.getTasksForDate("2026-08-06");

    assert.deepEqual(
      tasks.map((task) => task.title),
      ["Today task"]
    );
  });

  it("uses shared empty-title validation", async () => {
    const repository = await createRepository("validation-test");

    await assert.rejects(
      () =>
        repository.createTask({
          title: "   ",
          scheduledDate: "2026-08-06"
        }),
      TaskValidationError
    );
  });

  it("reports IndexedDB initialization failures", async () => {
    const failingIndexedDb = {
      open() {
        throw new Error("Browser storage is unavailable");
      }
    };

    await assert.rejects(
      () => openIndexedDbTaskStorage({ indexedDB: failingIndexedDb }),
      WebStorageInitializationError
    );
  });

  it("wraps web storage write failures", async () => {
    const storage = await openIndexedDbTaskStorage({
      databaseName: "write-failure-test",
      indexedDB: new IDBFactory()
    });
    storage.insertTask = async () => {
      throw new Error("Quota exceeded");
    };
    const repository = new TaskRepository(storage);

    await assert.rejects(
      () =>
        repository.createTask({
          title: "Keep this task",
          scheduledDate: "2026-08-06"
        }),
      TaskPersistenceError
    );
  });

  it("serializes nullable fields and rejects malformed stored data", () => {
    const task: Task = {
      id: "serialization-task",
      title: "Review notes",
      description: null,
      status: "not_started",
      scheduledDate: "2026-08-06",
      scheduledTime: null,
      createdAt: "2026-08-06T15:00:00.000Z",
      updatedAt: "2026-08-06T15:00:00.000Z",
      completedAt: null,
      deletedAt: null
    };

    assert.deepEqual(deserializeTaskFromWeb(serializeTaskForWeb(task)), task);
    assert.throws(
      () => deserializeTaskFromWeb({ ...task, scheduledDate: "August 6" }),
      WebStorageDataError
    );
  });
});

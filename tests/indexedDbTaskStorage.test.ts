import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { IDBFactory, IDBKeyRange } from "fake-indexeddb";

import {
  deserializeCalendarEventFromWeb,
  deserializeRecoveryItemFromWeb,
  deserializeRecoverySessionFromWeb,
  deserializeTaskFromWeb,
  openIndexedDbCalendarEventStorage,
  openIndexedDbStorages,
  openIndexedDbTaskStorage,
  serializeCalendarEventForWeb,
  serializeRecoveryItemForWeb,
  serializeRecoverySessionForWeb,
  serializeTaskForWeb,
  WebStorageDataError,
  WebStorageInitializationError
} from "../src/database/indexedDbTaskStorage.web";
import {
  TaskPersistenceError,
  TaskValidationError
} from "../src/database/repositories/errors";
import { TaskRepository } from "../src/database/repositories/taskRepository";
import { CalendarEventRepository } from "../src/database/repositories/calendarEventRepository";
import { DailyRecapRepository } from "../src/database/repositories/dailyRecapRepository";
import { RecoveryRepository } from "../src/database/repositories/recoveryRepository";
import { CalendarEvent } from "../src/types/calendarEvent";
import { RecoveryItem, RecoverySession } from "../src/types/recovery";
import { Task } from "../src/types/task";

function createRepository(databaseName: string, indexedDB = new IDBFactory()) {
  let id = 0;

  return openIndexedDbTaskStorage({
    databaseName,
    indexedDB,
    keyRange: IDBKeyRange
  }).then(
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
      scheduledTime: "12:30",
      estimatedDurationMinutes: 20
    });

    const reopenedRepository = await createRepository("persistence-test", indexedDB);
    const tasks = await reopenedRepository.getAllTasks();

    assert.deepEqual(tasks, [createdTask]);
  });

  it("persists unscheduled tasks", async () => {
    const repository = await createRepository("unscheduled-test");
    const createdTask = await repository.createTask({ title: "Read mail" });

    assert.equal(createdTask.scheduledDate, null);
    assert.equal((await repository.getAllTasks())[0]?.scheduledDate, null);
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
      indexedDB: new IDBFactory(),
      keyRange: IDBKeyRange
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
      estimatedDurationMinutes: null,
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

  it("reads legacy task records without duration data", () => {
    const legacyTask = {
      id: "legacy-task",
      title: "Existing task",
      description: null,
      status: "not_started",
      scheduledDate: "2026-08-06",
      scheduledTime: null,
      createdAt: "2026-08-06T15:00:00.000Z",
      updatedAt: "2026-08-06T15:00:00.000Z",
      completedAt: null,
      deletedAt: null
    };

    assert.equal(deserializeTaskFromWeb(legacyTask).estimatedDurationMinutes, null);
  });

  it("reads legacy task records without completion timestamp data", () => {
    const legacyCompletedTask = {
      id: "legacy-completed-task",
      title: "Older completed task",
      description: null,
      status: "completed",
      scheduledDate: "2026-08-06",
      scheduledTime: null,
      createdAt: "2026-08-06T15:00:00.000Z",
      updatedAt: "2026-08-06T15:00:00.000Z",
      deletedAt: null
    };

    assert.equal(deserializeTaskFromWeb(legacyCompletedTask).completedAt, null);
  });

  it("upgrades an existing version one task database", async () => {
    const indexedDB = new IDBFactory();
    const databaseName = "version-one-upgrade-test";
    await createVersionOneDatabase(indexedDB, databaseName);

    const storage = await openIndexedDbTaskStorage({ databaseName, indexedDB });
    const repository = new TaskRepository(storage);
    const tasks = await repository.getAllTasks();

    assert.equal(tasks[0]?.title, "Version one task");
    assert.equal(tasks[0]?.estimatedDurationMinutes, null);
  });
});

describe("IndexedDB calendar event storage", () => {
  it("persists and chronologically retrieves fixed events", async () => {
    const indexedDB = new IDBFactory();
    const storage = await openIndexedDbCalendarEventStorage({
      databaseName: "event-persistence-test",
      indexedDB,
      keyRange: IDBKeyRange
    });
    let id = 0;
    const repository = new CalendarEventRepository(
      storage,
      () => `web-event-${++id}`,
      () => new Date("2026-08-06T15:00:00.000Z")
    );
    await repository.createEvent({
      title: "Later event",
      date: "2026-08-06",
      startTime: "14:00"
    });
    await repository.createEvent({
      title: "Earlier event",
      date: "2026-08-06",
      startTime: "09:00",
      durationMinutes: 30
    });
    await repository.createEvent({
      title: "Outside range",
      date: "2026-08-08",
      startTime: "08:00"
    });

    const reopenedStorage = await openIndexedDbCalendarEventStorage({
      databaseName: "event-persistence-test",
      indexedDB,
      keyRange: IDBKeyRange
    });
    const reopenedRepository = new CalendarEventRepository(reopenedStorage);

    assert.deepEqual(
      (await reopenedRepository.getEventsForDate("2026-08-06")).map(
        (event) => event.title
      ),
      ["Earlier event", "Later event"]
    );
    assert.deepEqual(
      (await reopenedRepository.getEventsForRange("2026-08-05", "2026-08-07")).map(
        (event) => event.title
      ),
      ["Earlier event", "Later event"]
    );
  });

  it("serializes nullable event fields", () => {
    const event: CalendarEvent = {
      id: "serialization-event",
      title: "Appointment",
      kind: "fixed",
      date: "2026-08-06",
      startTime: "09:00",
      endTime: null,
      durationMinutes: 30,
      notes: null,
      createdAt: "2026-08-06T15:00:00.000Z",
      updatedAt: "2026-08-06T15:00:00.000Z"
    };

    assert.deepEqual(
      deserializeCalendarEventFromWeb(serializeCalendarEventForWeb(event)),
      event
    );
  });
});

describe("IndexedDB recovery storage", () => {
  it("persists recovery progress and completion across reopened storage", async () => {
    const indexedDB = new IDBFactory();
    const databaseName = "recovery-persistence-test";
    const first = await createRecoveryRepositories(databaseName, indexedDB);
    const firstTask = await first.taskRepository.createTask({
      title: "Move this task",
      scheduledDate: "2026-08-06",
      scheduledTime: "09:00"
    });
    const secondTask = await first.taskRepository.createTask({
      title: "Review this later",
      scheduledDate: "2026-08-06"
    });
    const session = await first.recoveryRepository.startSession("2026-08-06");
    const firstItem = session.items.find((item) => item.taskId === firstTask.id)!;
    const secondItem = session.items.find((item) => item.taskId === secondTask.id)!;

    await first.recoveryRepository.rescheduleTask(firstItem.id, {
      scheduledDate: "2026-08-09",
      scheduledTime: "14:00"
    });
    await first.recoveryRepository.skipTask(secondItem.id);

    const reopened = await createRecoveryRepositories(databaseName, indexedDB);
    const restoredSession = await reopened.recoveryRepository.getActiveSession();

    assert.equal(
      restoredSession?.items.find((item) => item.id === firstItem.id)?.decision,
      "reschedule"
    );
    assert.equal(
      restoredSession?.items.find((item) => item.id === secondItem.id)?.decision,
      "skip"
    );
    assert.equal(
      (await reopened.taskRepository.getAllTasks()).find(
        (task) => task.id === firstTask.id
      )?.scheduledDate,
      "2026-08-09"
    );

    await reopened.recoveryRepository.keepTask(secondItem.id);
    const completed = await reopened.recoveryRepository.completeSession();
    const completedRepository = await createRecoveryRepositories(databaseName, indexedDB);

    assert.equal(completed.status, "completed");
    assert.equal(await completedRepository.recoveryRepository.getActiveSession(), null);
    assert.equal(
      (await completedRepository.recoveryRepository.getLatestCompletedSession())?.id,
      completed.id
    );
    assert.deepEqual(
      (await completedRepository.recoveryRepository.getSessionsForDate("2026-08-06")).map(
        (storedSession) => storedSession.id
      ),
      [completed.id]
    );
  });

  it("derives a daily recap after browser storage is reopened", async () => {
    const indexedDB = new IDBFactory();
    const databaseName = "recap-persistence-test";
    const first = await createRecoveryRepositories(databaseName, indexedDB);
    const task = await first.taskRepository.createTask({
      title: "Browser accomplishment",
      scheduledDate: "2026-08-05"
    });
    await first.taskRepository.completeTask(task.id);
    await first.calendarEventRepository.createEvent({
      title: "Browser calendar event",
      date: "2026-08-07",
      startTime: "11:00"
    });

    const reopened = await createRecoveryRepositories(databaseName, indexedDB);
    const recap = await reopened.dailyRecapRepository.getDailyRecap("2026-08-07");

    assert.deepEqual(
      recap.accomplishedTasks.map((completedTask) => completedTask.title),
      ["Browser accomplishment"]
    );
    assert.deepEqual(
      recap.fixedEvents.map((event) => event.title),
      ["Browser calendar event"]
    );
  });

  it("applies breakdown, delegation, and removal mutations in browser storage", async () => {
    const context = await createRecoveryRepositories(
      "recovery-actions-test",
      new IDBFactory()
    );
    const breakdownTask = await context.taskRepository.createTask({
      title: "Large task",
      scheduledDate: "2026-08-06"
    });
    const delegatedTask = await context.taskRepository.createTask({
      title: "Shared task",
      scheduledDate: "2026-08-06"
    });
    const removedTask = await context.taskRepository.createTask({
      title: "Optional task",
      scheduledDate: "2026-08-06"
    });
    const session = await context.recoveryRepository.startSession("2026-08-06");

    await context.recoveryRepository.breakDownTask(
      session.items.find((item) => item.taskId === breakdownTask.id)!.id,
      { titles: ["First small task", "Second small task"] }
    );
    await context.recoveryRepository.delegateTask(
      session.items.find((item) => item.taskId === delegatedTask.id)!.id,
      { note: "Ask Lee" }
    );
    await context.recoveryRepository.removeTask(
      session.items.find((item) => item.taskId === removedTask.id)!.id
    );

    const tasks = await context.taskRepository.getAllTasks();
    assert.equal(
      tasks.find((task) => task.id === breakdownTask.id)?.status,
      "broken_down"
    );
    assert.equal(tasks.find((task) => task.id === delegatedTask.id)?.status, "delegated");
    assert.equal(tasks.find((task) => task.id === removedTask.id)?.status, "removed");
    assert.deepEqual(
      tasks
        .filter((task) => task.id.startsWith("web-smaller-task-"))
        .map((task) => task.scheduledDate),
      [null, null]
    );
  });

  it("serializes recovery sessions and items and rejects malformed decisions", () => {
    const item: RecoveryItem = {
      id: "item-1",
      sessionId: "session-1",
      taskId: "task-1",
      originalTitle: "Review notes",
      originalStatus: "not_started",
      originalScheduledDate: "2026-08-06",
      originalScheduledTime: null,
      originalEstimatedDurationMinutes: null,
      status: "pending",
      decision: "skip",
      note: null,
      rescheduledDate: null,
      rescheduledTime: null,
      createdTaskIds: [],
      reviewedAt: "2026-08-07T15:00:00.000Z",
      createdAt: "2026-08-07T15:00:00.000Z",
      updatedAt: "2026-08-07T15:00:00.000Z"
    };
    const session: RecoverySession = {
      id: "session-1",
      sourceDate: "2026-08-06",
      status: "active",
      startedAt: "2026-08-07T15:00:00.000Z",
      completedAt: null,
      items: [item]
    };

    assert.deepEqual(
      deserializeRecoveryItemFromWeb(serializeRecoveryItemForWeb(item)),
      item
    );
    assert.deepEqual(
      deserializeRecoverySessionFromWeb(serializeRecoverySessionForWeb(session)),
      {
        id: session.id,
        sourceDate: session.sourceDate,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt
      }
    );
    assert.throws(
      () =>
        deserializeRecoveryItemFromWeb({
          ...item,
          status: "resolved",
          decision: "skip"
        }),
      WebStorageDataError
    );
  });
});

async function createRecoveryRepositories(databaseName: string, indexedDB: IDBFactory) {
  const { taskStorage, calendarEventStorage, recoveryStorage } =
    await openIndexedDbStorages({
      databaseName,
      indexedDB,
      keyRange: IDBKeyRange
    });
  let taskId = 0;
  let smallerTaskId = 0;
  let itemId = 0;
  let sessionId = 0;
  let eventId = 0;
  const clock = () => new Date("2026-08-07T15:00:00.000Z");
  const taskRepository = new TaskRepository(
    taskStorage,
    () => `web-recovery-task-${++taskId}`,
    clock
  );
  const calendarEventRepository = new CalendarEventRepository(
    calendarEventStorage,
    () => `web-recap-event-${++eventId}`,
    clock
  );
  const recoveryRepository = new RecoveryRepository(
    recoveryStorage,
    taskStorage,
    () => `web-session-${++sessionId}`,
    () => `web-item-${++itemId}`,
    () => `web-smaller-task-${++smallerTaskId}`,
    clock
  );

  return {
    taskRepository,
    calendarEventRepository,
    recoveryRepository,
    dailyRecapRepository: new DailyRecapRepository(
      taskRepository,
      calendarEventRepository,
      recoveryRepository
    )
  };
}

function createVersionOneDatabase(
  indexedDB: IDBFactory,
  databaseName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);

    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("tasks", { keyPath: "id" });
      store.createIndex("scheduledDate", "scheduledDate", { unique: false });
      store.createIndex("updatedAt", "updatedAt", { unique: false });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("tasks", "readwrite");
      transaction.objectStore("tasks").add({
        id: "version-one-task",
        title: "Version one task",
        description: null,
        status: "not_started",
        scheduledDate: "2026-08-06",
        scheduledTime: null,
        createdAt: "2026-08-06T15:00:00.000Z",
        updatedAt: "2026-08-06T15:00:00.000Z",
        completedAt: null,
        deletedAt: null
      });
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
    };
  });
}

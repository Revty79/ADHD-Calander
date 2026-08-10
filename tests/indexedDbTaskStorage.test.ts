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
import { SettingsRepository } from "../src/database/repositories/settingsRepository";
import { CalendarEvent } from "../src/types/calendarEvent";
import { RecoveryItem, RecoverySession } from "../src/types/recovery";
import { getTaskPlanningState, Task } from "../src/types/task";

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
  it("persists settings after browser storage reinitialization", async () => {
    const indexedDB = new IDBFactory();
    const options = {
      databaseName: "settings-persistence-test",
      indexedDB,
      keyRange: IDBKeyRange
    };
    const firstStorages = await openIndexedDbStorages(options);
    const firstRepository = new SettingsRepository(firstStorages.settingsStorage);

    assert.equal((await firstRepository.getSettings()).remindersEnabled, false);
    await firstRepository.setRemindersEnabled(true);

    const reopenedStorages = await openIndexedDbStorages(options);
    const reopenedRepository = new SettingsRepository(reopenedStorages.settingsStorage);

    assert.equal((await reopenedRepository.getSettings()).remindersEnabled, true);
  });

  it("initializes an empty web task store", async () => {
    const indexedDB = new IDBFactory();
    const databaseName = "initialization-test";
    const repository = await createRepository(databaseName, indexedDB);

    assert.deepEqual(await repository.getAllTasks(), []);
    assert.equal((await readIndexedDbSnapshot(indexedDB, databaseName)).version, 10);
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

  it("persists and clears planned preferred time and deadline time", async () => {
    const indexedDB = new IDBFactory();
    const databaseName = "task-time-persistence-test";
    const firstRepository = await createRepository(databaseName, indexedDB);
    const task = await firstRepository.createTask({
      title: "Prepare browser notes",
      scheduledDate: "2026-08-08",
      preferredTime: "14:00",
      deadlineDate: "2026-08-09",
      deadlineTime: "15:30"
    });

    const reopenedRepository = await createRepository(databaseName, indexedDB);
    const reopenedTask = await reopenedRepository.getTaskById(task.id);

    assert.equal(reopenedTask.id, task.id);
    assert.equal(getTaskPlanningState(reopenedTask), "planned");
    assert.equal(reopenedTask.preferredTime, "14:00");
    assert.equal(reopenedTask.deadlineTime, "15:30");

    const cleared = await reopenedRepository.updateTask(task.id, {
      ...reopenedTask,
      preferredTime: null,
      deadlineTime: null
    });
    const finalRepository = await createRepository(databaseName, indexedDB);
    const finalTask = await finalRepository.getTaskById(task.id);

    assert.equal(cleared.id, task.id);
    assert.equal(finalTask.id, task.id);
    assert.equal(getTaskPlanningState(finalTask), "planned");
    assert.equal(finalTask.preferredTime, null);
    assert.equal(finalTask.deadlineDate, "2026-08-09");
    assert.equal(finalTask.deadlineTime, null);
  });

  it("persists started state and multiple reminders after browser restart", async () => {
    const indexedDB = new IDBFactory();
    const firstRepository = await createRepository(
      "execution-reminders-persistence-test",
      indexedDB
    );
    const task = await firstRepository.createTask({
      title: "Prepare browser notes",
      scheduledDate: "2026-08-08",
      scheduledTime: "10:00",
      reminderOffsets: [60, 15, 0]
    });
    await firstRepository.startTask(task.id);

    const reopenedRepository = await createRepository(
      "execution-reminders-persistence-test",
      indexedDB
    );
    const reopenedTask = await reopenedRepository.getTaskById(task.id);

    assert.equal(reopenedTask.status, "started");
    assert.equal(reopenedTask.startedAt, "2026-08-06T15:00:00.000Z");
    assert.deepEqual(reopenedTask.reminderOffsets, [60, 15, 0]);
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
      importance: "normal",
      status: "not_started",
      parentTaskId: null,
      scheduledDate: "2026-08-06",
      scheduledTime: null,
      preferredTime: null,
      estimatedDurationMinutes: null,
      deadlineDate: null,
      deadlineTime: null,
      reminders: [],
      reminderOffsets: [],
      startedAt: null,
      createdAt: "2026-08-06T15:00:00.000Z",
      updatedAt: "2026-08-06T15:00:00.000Z",
      completedAt: null,
      deletedAt: null
    };

    assert.deepEqual(deserializeTaskFromWeb(serializeTaskForWeb(task)), task);
    assert.deepEqual(
      deserializeTaskFromWeb({
        ...task,
        reminderOffsetMinutes: undefined
      }).reminderOffsets,
      []
    );
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
    assert.equal(deserializeTaskFromWeb(legacyTask).deadlineDate, null);
    assert.equal(deserializeTaskFromWeb(legacyTask).importance, "normal");
    assert.equal(deserializeTaskFromWeb(legacyTask).parentTaskId, null);
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
    assert.equal(tasks[0]?.importance, "normal");
    assert.equal(tasks[0]?.parentTaskId, null);
  });

  it("upgrades version six single reminders to persisted reminder arrays", async () => {
    const indexedDB = new IDBFactory();
    const databaseName = "version-six-reminder-upgrade-test";
    await createVersionSixReminderDatabase(indexedDB, databaseName);

    const storages = await openIndexedDbStorages({
      databaseName,
      indexedDB,
      keyRange: IDBKeyRange
    });
    const task = await storages.taskStorage.getTaskById("version-six-task");
    const events = await storages.calendarEventStorage.getAllEvents();

    assert.deepEqual(task?.reminderOffsets, [30]);
    assert.equal(task?.startedAt, null);
    assert.deepEqual(events[0]?.reminderOffsets, [60]);

    const reopened = await openIndexedDbStorages({
      databaseName,
      indexedDB,
      keyRange: IDBKeyRange
    });
    assert.deepEqual(
      (await reopened.taskStorage.getTaskById("version-six-task"))?.reminderOffsets,
      [30]
    );
  });

  it("opens a previous version eight database without changing existing records", async () => {
    const indexedDB = new IDBFactory();
    const databaseName = "version-eight-rollback-compatibility-test";
    const existingTask: Task = {
      id: "version-eight-task",
      title: "Existing completed task",
      description: "Preserve this history",
      importance: "important",
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
      id: "version-eight-event",
      title: "Existing fixed commitment",
      kind: "fixed",
      date: "2026-08-08",
      startTime: "11:00",
      endTime: null,
      durationMinutes: 30,
      notes: "Keep this event",
      reminders: [{ kind: "relative", offsetMinutes: 30 }],
      reminderOffsets: [30],
      createdAt: "2026-08-07T14:00:00.000Z",
      updatedAt: "2026-08-07T14:00:00.000Z"
    };
    const existingRecoveryItem: RecoveryItem = {
      id: "version-eight-recovery-item",
      sessionId: "version-eight-recovery-session",
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
    };
    const existingRecoverySession: RecoverySession = {
      id: existingRecoveryItem.sessionId,
      sourceDate: "2026-08-08",
      status: "completed",
      startedAt: "2026-08-08T17:00:00.000Z",
      completedAt: "2026-08-08T17:05:00.000Z",
      items: [existingRecoveryItem]
    };
    const existingSettings = [
      {
        key: "reminders_enabled",
        value: "true",
        updatedAt: "2026-08-07T14:00:00.000Z"
      },
      {
        key: "planning_day_start",
        value: "07:00",
        updatedAt: "2026-08-07T14:00:00.000Z"
      },
      {
        key: "transition_buffer_minutes",
        value: "30",
        updatedAt: "2026-08-07T14:00:00.000Z"
      }
    ];

    await createPreviousVersionDatabase(indexedDB, databaseName, 8, {
      tasks: [
        {
          ...omitVersionNineTaskFields(existingTask),
          plannedTimePreference: "morning"
        }
      ],
      calendarEvents: [omitVersionTenEventFields(existingEvent)],
      recoverySessions: [serializeRecoverySessionForWeb(existingRecoverySession)],
      recoveryItems: [
        {
          ...omitVersionNineRecoveryFields(existingRecoveryItem),
          originalPlannedTimePreference: "morning"
        }
      ],
      appSettings: existingSettings
    });
    const beforeOpen = await readIndexedDbSnapshot(indexedDB, databaseName);

    const storages = await openIndexedDbStorages({
      databaseName,
      indexedDB,
      keyRange: IDBKeyRange
    });
    const openedTask = await storages.taskStorage.getTaskById(existingTask.id);

    assert.deepEqual(openedTask, existingTask);
    assert.deepEqual(await storages.calendarEventStorage.getAllEvents(), [existingEvent]);
    assert.deepEqual(await storages.recoveryStorage.getSessionsForDate("2026-08-08"), [
      existingRecoverySession
    ]);
    assert.deepEqual(
      await storages.settingsStorage.getSetting("planning_day_start"),
      existingSettings[1]
    );
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
    assert.equal(openedTask && "plannedTimePreference" in openedTask, false);
    const afterOpen = await readIndexedDbSnapshot(indexedDB, databaseName);
    const { version: beforeVersion, ...beforeRecords } = beforeOpen;
    const { version: afterVersion, ...afterRecords } = afterOpen;

    assert.equal(beforeVersion, 8);
    assert.equal(afterVersion, 10);
    assert.deepEqual(afterRecords, beforeRecords);
  });

  it("opens a previous version nine database and preserves reminder records", async () => {
    const indexedDB = new IDBFactory();
    const databaseName = "version-nine-reminder-compatibility-test";
    const existingTask: Task = {
      id: "version-nine-task",
      title: "Existing version nine task",
      description: "Keep every field",
      importance: "important",
      status: "started",
      parentTaskId: null,
      scheduledDate: "2026-08-09",
      scheduledTime: "14:30",
      preferredTime: null,
      estimatedDurationMinutes: 45,
      deadlineDate: "2026-08-10",
      deadlineTime: "17:00",
      reminders: [
        { kind: "relative", offsetMinutes: 60 },
        { kind: "relative", offsetMinutes: 15 }
      ],
      reminderOffsets: [60, 15],
      startedAt: "2026-08-09T20:00:00.000Z",
      createdAt: "2026-08-08T14:00:00.000Z",
      updatedAt: "2026-08-09T20:00:00.000Z",
      completedAt: null,
      deletedAt: null
    };

    await createPreviousVersionDatabase(indexedDB, databaseName, 9, {
      tasks: [omitVersionTenTaskFields(existingTask)],
      calendarEvents: [],
      recoverySessions: [],
      recoveryItems: [],
      appSettings: []
    });
    const beforeOpen = await readIndexedDbSnapshot(indexedDB, databaseName);
    const storages = await openIndexedDbStorages({
      databaseName,
      indexedDB,
      keyRange: IDBKeyRange
    });

    assert.deepEqual(
      await storages.taskStorage.getTaskById(existingTask.id),
      existingTask
    );
    const afterOpen = await readIndexedDbSnapshot(indexedDB, databaseName);
    const { version: beforeVersion, ...beforeRecords } = beforeOpen;
    const { version: afterVersion, ...afterRecords } = afterOpen;

    assert.equal(beforeVersion, 9);
    assert.equal(afterVersion, 10);
    assert.deepEqual(afterRecords, beforeRecords);
  });

  it("persists edits, breakdown relationships, removal, and restoration", async () => {
    const indexedDB = new IDBFactory();
    const databaseName = "functional-task-lifecycle-test";
    const firstRepository = await createRepository(databaseName, indexedDB);
    const parent = await firstRepository.createTask({ title: "Plan workshop" });
    await firstRepository.updateTask(parent.id, {
      ...parent,
      title: "Plan team workshop",
      importance: "important",
      scheduledDate: "2026-08-08"
    });
    const children = await firstRepository.breakDownTask(parent.id, {
      titles: ["Choose format", "Send invite"]
    });
    await firstRepository.removeTask(children[0]!.id);

    const reopenedRepository = await createRepository(databaseName, indexedDB);
    const reopenedParent = await reopenedRepository.getTaskById(parent.id);
    const reopenedChildren = await reopenedRepository.getChildTasks(parent.id);

    assert.equal(reopenedParent.title, "Plan team workshop");
    assert.equal(reopenedParent.importance, "important");
    assert.equal(reopenedParent.status, "broken_down");
    assert.ok(reopenedChildren.every((child) => child.parentTaskId === parent.id));
    assert.equal(reopenedChildren[0]?.status, "removed");

    const restoredChild = await reopenedRepository.restoreTask(children[0]!.id);
    assert.equal(restoredChild.status, "not_started");
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
      reminders: [],
      reminderOffsets: [],
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
        .map((task) => ({
          parentTaskId: task.parentTaskId,
          scheduledDate: task.scheduledDate
        })),
      [
        { parentTaskId: breakdownTask.id, scheduledDate: null },
        { parentTaskId: breakdownTask.id, scheduledDate: null }
      ]
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
      originalPreferredTime: null,
      originalEstimatedDurationMinutes: null,
      originalReminders: [],
      originalReminderOffsets: [],
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

function createVersionSixReminderDatabase(
  indexedDB: IDBFactory,
  databaseName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 6);

    request.onupgradeneeded = () => {
      request.result.createObjectStore("tasks", { keyPath: "id" });
      request.result.createObjectStore("calendarEvents", { keyPath: "id" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(["tasks", "calendarEvents"], "readwrite");
      transaction.objectStore("tasks").add({
        id: "version-six-task",
        title: "Existing browser task",
        description: null,
        importance: "normal",
        status: "not_started",
        parentTaskId: null,
        scheduledDate: "2026-08-08",
        scheduledTime: "10:00",
        estimatedDurationMinutes: 30,
        deadlineDate: null,
        reminderOffsetMinutes: 30,
        createdAt: "2026-08-06T15:00:00.000Z",
        updatedAt: "2026-08-06T15:00:00.000Z",
        completedAt: null,
        deletedAt: null
      });
      transaction.objectStore("calendarEvents").add({
        id: "version-six-event",
        title: "Existing browser event",
        kind: "fixed",
        date: "2026-08-08",
        startTime: "11:00",
        endTime: null,
        durationMinutes: 30,
        notes: null,
        reminderOffsetMinutes: 60,
        createdAt: "2026-08-06T15:00:00.000Z",
        updatedAt: "2026-08-06T15:00:00.000Z"
      });
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
    };
  });
}

function omitVersionNineTaskFields(task: Task): Record<string, unknown> {
  const record = omitVersionTenTaskFields(task);
  delete record.preferredTime;
  delete record.deadlineTime;

  return record;
}

function omitVersionNineRecoveryFields(item: RecoveryItem): Record<string, unknown> {
  const record = omitVersionTenRecoveryFields(item);
  delete record.originalPreferredTime;

  return record;
}

function omitVersionTenTaskFields(task: Task): Record<string, unknown> {
  const record: Record<string, unknown> = { ...serializeTaskForWeb(task) };
  delete record.reminders;

  return record;
}

function omitVersionTenEventFields(event: CalendarEvent): Record<string, unknown> {
  const record: Record<string, unknown> = { ...serializeCalendarEventForWeb(event) };
  delete record.reminders;

  return record;
}

function omitVersionTenRecoveryFields(item: RecoveryItem): Record<string, unknown> {
  const record: Record<string, unknown> = { ...serializeRecoveryItemForWeb(item) };
  delete record.originalReminders;

  return record;
}

type IndexedDbSnapshot = {
  version: number;
  tasks: unknown[];
  calendarEvents: unknown[];
  recoverySessions: unknown[];
  recoveryItems: unknown[];
  appSettings: unknown[];
};

function createPreviousVersionDatabase(
  indexedDB: IDBFactory,
  databaseName: string,
  version: 8 | 9,
  records: Omit<IndexedDbSnapshot, "version">
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, version);

    request.onupgradeneeded = () => {
      const database = request.result;
      const taskStore = database.createObjectStore("tasks", { keyPath: "id" });
      taskStore.createIndex("scheduledDate", "scheduledDate", { unique: false });
      taskStore.createIndex("updatedAt", "updatedAt", { unique: false });
      taskStore.createIndex("parentTaskId", "parentTaskId", { unique: false });
      const eventStore = database.createObjectStore("calendarEvents", {
        keyPath: "id"
      });
      eventStore.createIndex("date", "date", { unique: false });
      eventStore.createIndex("updatedAt", "updatedAt", { unique: false });
      const recoverySessionStore = database.createObjectStore("recoverySessions", {
        keyPath: "id"
      });
      recoverySessionStore.createIndex("status", "status", { unique: false });
      recoverySessionStore.createIndex("completedAt", "completedAt", {
        unique: false
      });
      const recoveryItemStore = database.createObjectStore("recoveryItems", {
        keyPath: "id"
      });
      recoveryItemStore.createIndex("sessionId", "sessionId", { unique: false });
      recoveryItemStore.createIndex("status", "status", { unique: false });
      database.createObjectStore("appSettings", { keyPath: "key" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const storeNames = Object.keys(records);
      const transaction = database.transaction(storeNames, "readwrite");

      for (const storeName of storeNames) {
        for (const record of records[storeName as keyof typeof records]) {
          transaction.objectStore(storeName).put(record);
        }
      }

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
    };
  });
}

async function readIndexedDbSnapshot(
  indexedDB: IDBFactory,
  databaseName: string
): Promise<IndexedDbSnapshot> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  const storeNames = [
    "tasks",
    "calendarEvents",
    "recoverySessions",
    "recoveryItems",
    "appSettings"
  ] as const;
  const transaction = database.transaction([...storeNames], "readonly");
  const records = await Promise.all(
    storeNames.map(
      (storeName) =>
        new Promise<unknown[]>((resolve, reject) => {
          const request = transaction.objectStore(storeName).getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        })
    )
  );
  const [tasks, calendarEvents, recoverySessions, recoveryItems, appSettings] = records;
  database.close();

  return {
    version: database.version,
    tasks: tasks ?? [],
    calendarEvents: calendarEvents ?? [],
    recoverySessions: recoverySessions ?? [],
    recoveryItems: recoveryItems ?? [],
    appSettings: appSettings ?? []
  };
}

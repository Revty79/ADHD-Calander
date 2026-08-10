import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { initializeDatabase } from "../src/database/database";
import { CalendarEventRepository } from "../src/database/repositories/calendarEventRepository";
import { RecoveryValidationError } from "../src/database/repositories/recoveryErrors";
import { RecoveryRepository } from "../src/database/repositories/recoveryRepository";
import { TaskRepository } from "../src/database/repositories/taskRepository";
import { SqlCalendarEventStorage } from "../src/database/sqlCalendarEventStorage";
import { SqlRecoveryStorage } from "../src/database/sqlRecoveryStorage";
import { SqlTaskStorage } from "../src/database/sqlTaskStorage";
import { buildCalendarSchedule } from "../src/features/calendar/calendarSchedule";
import { applyRecoveryEntryDecision } from "../src/features/recovery/recoveryEntry";
import { createSqlJsDatabase } from "./helpers/sqlJsDatabase";

const sourceDate = "2026-08-06";
const timestamp = "2026-08-07T15:00:00.000Z";

async function createContext() {
  const database = await createSqlJsDatabase();
  await initializeDatabase(database);
  const taskStorage = new SqlTaskStorage(database);
  let taskId = 0;
  let recoveryTaskId = 0;
  let itemId = 0;
  let sessionId = 0;
  const taskRepository = new TaskRepository(
    taskStorage,
    () => `task-${++taskId}`,
    () => new Date(timestamp)
  );
  const recoveryRepository = new RecoveryRepository(
    new SqlRecoveryStorage(database),
    taskStorage,
    () => `session-${++sessionId}`,
    () => `item-${++itemId}`,
    () => `smaller-task-${++recoveryTaskId}`,
    () => new Date(timestamp)
  );

  return { database, taskStorage, taskRepository, recoveryRepository };
}

async function createScheduledTask(
  taskRepository: TaskRepository,
  title: string,
  scheduledTime: string | null = null
) {
  return taskRepository.createTask({
    title,
    scheduledDate: sourceDate,
    ...(scheduledTime ? { scheduledTime } : {})
  });
}

describe("RecoveryRepository", () => {
  it("starts one persisted session with only unfinished tasks", async () => {
    const { database, taskRepository, recoveryRepository } = await createContext();
    const unfinishedTask = await createScheduledTask(
      taskRepository,
      "Unfinished task",
      "10:00"
    );
    await taskRepository.startTask(unfinishedTask.id);
    const completedTask = await createScheduledTask(
      taskRepository,
      "Completed task",
      "09:00"
    );
    await taskRepository.completeTask(completedTask.id);
    const eventRepository = new CalendarEventRepository(
      new SqlCalendarEventStorage(database),
      () => "fixed-event",
      () => new Date(timestamp)
    );
    await eventRepository.createEvent({
      title: "Fixed appointment",
      date: sourceDate,
      startTime: "11:00"
    });

    const session = await recoveryRepository.startSession(sourceDate);
    const sameSession = await recoveryRepository.startSession("2026-08-07");

    assert.equal(session.id, sameSession.id);
    assert.deepEqual(
      session.items.map((item) => item.originalTitle),
      ["Unfinished task"]
    );
    assert.equal(session.items[0]?.originalScheduledTime, "10:00");
    assert.equal(session.items[0]?.originalStatus, "started");
  });

  it("cancels Recovery entry without mutation and resumes one active session", async () => {
    const { taskRepository, recoveryRepository } = await createContext();
    await createScheduledTask(taskRepository, "Review this task");

    const cancelled = await applyRecoveryEntryDecision(
      "cancel",
      recoveryRepository,
      sourceDate
    );
    assert.equal(cancelled, null);
    assert.equal(await recoveryRepository.getActiveSession(), null);

    const started = await applyRecoveryEntryDecision(
      "confirm",
      recoveryRepository,
      sourceDate
    );
    const resumed = await applyRecoveryEntryDecision(
      "confirm",
      recoveryRepository,
      "2026-08-07"
    );

    assert.equal(resumed?.id, started?.id);
    assert.equal((await recoveryRepository.getActiveSession())?.id, started?.id);
  });

  it("keeps a task unscheduled without flattening recorded progress", async () => {
    const { taskStorage, taskRepository, recoveryRepository } = await createContext();
    const task = await createScheduledTask(taskRepository, "Keep this task", "10:00");
    await taskStorage.updateTask({ ...task, status: "partially_completed" });
    const session = await recoveryRepository.startSession(sourceDate);

    const updatedSession = await recoveryRepository.keepTask(session.items[0]!.id);
    const storedTask = await taskStorage.getTaskById(task.id);

    assert.equal(updatedSession.items[0]?.decision, "keep");
    assert.equal(storedTask?.status, "partially_completed");
    assert.equal(storedTask?.scheduledDate, null);
    assert.equal(storedTask?.scheduledTime, null);
  });

  it("reschedules the same task identity and updates calendar placement", async () => {
    const { taskStorage, taskRepository, recoveryRepository } = await createContext();
    const task = await createScheduledTask(taskRepository, "Move this task", "10:00");
    const session = await recoveryRepository.startSession(sourceDate);

    await recoveryRepository.rescheduleTask(session.items[0]!.id, {
      scheduledDate: "2026-08-09",
      scheduledTime: "14:30"
    });
    const storedTask = await taskStorage.getTaskById(task.id);
    const schedule = buildCalendarSchedule(
      "2026-08-09",
      "2026-08-09",
      [],
      storedTask ? [storedTask] : []
    );

    assert.equal(storedTask?.id, task.id);
    assert.equal(storedTask?.scheduledDate, "2026-08-09");
    assert.equal(storedTask?.scheduledTime, "14:30");
    assert.equal(schedule.get("2026-08-09")?.plannedTasks[0]?.id, task.id);
  });

  it("breaks a task into unscheduled children and resolves the original", async () => {
    const { taskStorage, taskRepository, recoveryRepository } = await createContext();
    const task = await createScheduledTask(taskRepository, "Prepare report");
    const session = await recoveryRepository.startSession(sourceDate);

    const updatedSession = await recoveryRepository.breakDownTask(session.items[0]!.id, {
      titles: ["Gather notes", "Write first paragraph"]
    });
    const originalTask = await taskStorage.getTaskById(task.id);
    const tasks = await taskStorage.getAllTasks();
    const children = tasks.filter((candidate) => candidate.id !== task.id);

    assert.equal(originalTask?.status, "broken_down");
    assert.deepEqual(
      children.map((child) => child.title),
      ["Gather notes", "Write first paragraph"]
    );
    assert.ok(children.every((child) => child.scheduledDate === null));
    assert.ok(children.every((child) => child.parentTaskId === task.id));
    assert.deepEqual(
      updatedSession.items[0]?.createdTaskIds,
      children.map((child) => child.id)
    );
  });

  it("records delegation and removal without deleting task history", async () => {
    const { taskStorage, taskRepository, recoveryRepository } = await createContext();
    const delegatedTask = await createScheduledTask(taskRepository, "Ask for help");
    const removedTask = await createScheduledTask(taskRepository, "Optional errand");
    const session = await recoveryRepository.startSession(sourceDate);

    const delegatedItem = session.items.find((item) => item.taskId === delegatedTask.id)!;
    const removedItem = session.items.find((item) => item.taskId === removedTask.id)!;
    await recoveryRepository.delegateTask(delegatedItem.id, {
      note: "Ask Jordan on Monday"
    });
    const updatedSession = await recoveryRepository.removeTask(removedItem.id);

    assert.equal((await taskStorage.getTaskById(delegatedTask.id))?.status, "delegated");
    assert.equal((await taskStorage.getTaskById(removedTask.id))?.status, "removed");
    assert.equal(
      updatedSession.items.find((item) => item.id === delegatedItem.id)?.note,
      "Ask Jordan on Monday"
    );
    assert.equal((await taskStorage.getAllTasks()).length, 2);
  });

  it("keeps decide-later items pending and reviewable", async () => {
    const { taskStorage, taskRepository, recoveryRepository } = await createContext();
    const task = await createScheduledTask(taskRepository, "Need more context");
    const session = await recoveryRepository.startSession(sourceDate);

    const skippedSession = await recoveryRepository.skipTask(session.items[0]!.id);

    assert.equal(skippedSession.items[0]?.status, "pending");
    assert.equal(skippedSession.items[0]?.decision, "skip");
    assert.equal((await taskStorage.getTaskById(task.id))?.status, "not_started");
    await assert.rejects(
      () => recoveryRepository.completeSession(),
      RecoveryValidationError
    );

    const resolvedSession = await recoveryRepository.keepTask(session.items[0]!.id);
    assert.equal(resolvedSession.items[0]?.status, "resolved");
  });

  it("reopens a decision and restores the original task schedule", async () => {
    const { taskStorage, taskRepository, recoveryRepository } = await createContext();
    const task = await createScheduledTask(taskRepository, "Change my mind", "08:30");
    const session = await recoveryRepository.startSession(sourceDate);
    const itemId = session.items[0]!.id;
    await recoveryRepository.rescheduleTask(itemId, {
      scheduledDate: "2026-08-10",
      scheduledTime: "16:00"
    });

    const reopenedSession = await recoveryRepository.reopenItem(itemId);
    const restoredTask = await taskStorage.getTaskById(task.id);

    assert.equal(reopenedSession.items[0]?.status, "pending");
    assert.equal(reopenedSession.items[0]?.decision, null);
    assert.equal(restoredTask?.scheduledDate, sourceDate);
    assert.equal(restoredTask?.scheduledTime, "08:30");
  });

  it("reopens a decision and restores a Planned task's preferred time", async () => {
    const { taskStorage, taskRepository, recoveryRepository } = await createContext();
    const task = await taskRepository.createTask({
      title: "Return to the softer plan",
      scheduledDate: sourceDate,
      preferredTime: "08:30"
    });
    const session = await recoveryRepository.startSession(sourceDate);
    const itemId = session.items[0]!.id;
    await recoveryRepository.rescheduleTask(itemId, {
      scheduledDate: "2026-08-10",
      scheduledTime: "16:00"
    });

    await recoveryRepository.reopenItem(itemId);
    const restoredTask = await taskStorage.getTaskById(task.id);

    assert.equal(restoredTask?.scheduledDate, sourceDate);
    assert.equal(restoredTask?.scheduledTime, null);
    assert.equal(restoredTask?.preferredTime, "08:30");
  });

  it("persists active progress and completed sessions across reinitialization", async () => {
    const { database, taskRepository, recoveryRepository } = await createContext();
    await createScheduledTask(taskRepository, "Persist this decision");
    const session = await recoveryRepository.startSession(sourceDate);
    await recoveryRepository.keepTask(session.items[0]!.id);

    const restoredDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(restoredDatabase);
    const restoredTaskStorage = new SqlTaskStorage(restoredDatabase);
    const restoredRepository = new RecoveryRepository(
      new SqlRecoveryStorage(restoredDatabase),
      restoredTaskStorage,
      () => "unused-session",
      () => "unused-item",
      () => "unused-task",
      () => new Date(timestamp)
    );
    const restoredActiveSession = await restoredRepository.getActiveSession();

    assert.equal(restoredActiveSession?.items[0]?.decision, "keep");
    const completedSession = await restoredRepository.completeSession();
    assert.equal(completedSession.status, "completed");
    assert.equal(await restoredRepository.getActiveSession(), null);
    assert.equal(
      (await restoredRepository.getLatestCompletedSession())?.id,
      completedSession.id
    );
  });

  it("rejects breakdowns that do not reduce the task", async () => {
    const { taskRepository, recoveryRepository } = await createContext();
    await createScheduledTask(taskRepository, "Too broad");
    const session = await recoveryRepository.startSession(sourceDate);

    await assert.rejects(
      () =>
        recoveryRepository.breakDownTask(session.items[0]!.id, {
          titles: ["Only one step"]
        }),
      (error) => {
        assert.ok(error instanceof RecoveryValidationError);
        assert.equal(error.field, "breakdownTitles");
        return true;
      }
    );
  });

  it("does not shift the source date through UTC conversion", async () => {
    const { taskRepository, recoveryRepository } = await createContext();
    await createScheduledTask(taskRepository, "Local date task");

    const session = await recoveryRepository.startSession(sourceDate);

    assert.equal(session.sourceDate, sourceDate);
    assert.equal(session.items[0]?.originalScheduledDate, sourceDate);
  });
});

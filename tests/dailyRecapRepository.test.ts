import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { initializeDatabase } from "../src/database/database";
import { CalendarEventRepository } from "../src/database/repositories/calendarEventRepository";
import { DailyRecapRepository } from "../src/database/repositories/dailyRecapRepository";
import { RecoveryRepository } from "../src/database/repositories/recoveryRepository";
import { TaskRepository } from "../src/database/repositories/taskRepository";
import { SqlCalendarEventStorage } from "../src/database/sqlCalendarEventStorage";
import { SqlRecoveryStorage } from "../src/database/sqlRecoveryStorage";
import { SqlTaskStorage } from "../src/database/sqlTaskStorage";
import { createSqlJsDatabase, SqlJsDatabase } from "./helpers/sqlJsDatabase";

async function createContext(database?: SqlJsDatabase) {
  const activeDatabase = database ?? (await createSqlJsDatabase());
  await initializeDatabase(activeDatabase);
  const taskStorage = new SqlTaskStorage(activeDatabase);
  let currentTime = new Date(2026, 7, 6, 9, 0);
  let taskId = 0;
  let eventId = 0;
  let sessionId = 0;
  let itemId = 0;
  let smallerTaskId = 0;
  const clock = () => currentTime;
  const taskRepository = new TaskRepository(
    taskStorage,
    () => `recap-task-${++taskId}`,
    clock
  );
  const calendarEventRepository = new CalendarEventRepository(
    new SqlCalendarEventStorage(activeDatabase),
    () => `recap-event-${++eventId}`,
    clock
  );
  const recoveryRepository = new RecoveryRepository(
    new SqlRecoveryStorage(activeDatabase),
    taskStorage,
    () => `recap-session-${++sessionId}`,
    () => `recap-item-${++itemId}`,
    () => `recap-smaller-task-${++smallerTaskId}`,
    clock
  );
  const dailyRecapRepository = new DailyRecapRepository(
    taskRepository,
    calendarEventRepository,
    recoveryRepository
  );

  return {
    database: activeDatabase,
    taskStorage,
    taskRepository,
    calendarEventRepository,
    recoveryRepository,
    dailyRecapRepository,
    setTime(date: Date) {
      currentTime = date;
    }
  };
}

describe("DailyRecapRepository", () => {
  it("uses actual local completion dates instead of scheduled dates", async () => {
    const context = await createContext();
    const selectedDate = "2026-01-05";
    const completedFromAnotherDay = await context.taskRepository.createTask({
      title: "Finished from yesterday",
      scheduledDate: "2026-01-04",
      estimatedDurationMinutes: 25
    });
    await context.taskRepository.createTask({
      title: "Scheduled but unfinished",
      scheduledDate: selectedDate
    });
    const completedLater = await context.taskRepository.createTask({
      title: "Completed on another day",
      scheduledDate: selectedDate
    });
    context.setTime(new Date(2026, 0, 5, 23, 45));
    await context.taskRepository.completeTask(completedFromAnotherDay.id);
    context.setTime(new Date(2026, 0, 6, 8, 0));
    await context.taskRepository.completeTask(completedLater.id);

    const recap = await context.dailyRecapRepository.getDailyRecap(selectedDate);

    assert.deepEqual(
      recap.accomplishedTasks.map((task) => task.title),
      ["Finished from yesterday"]
    );
    assert.equal(recap.completedEstimatedMinutes, 25);
    assert.deepEqual(
      recap.stillOpenTasks.map(({ task }) => task.title),
      ["Scheduled but unfinished"]
    );
  });

  it("treats startedAt as in progress and only completedAt as accomplishment", async () => {
    const context = await createContext();
    const task = await context.taskRepository.createTask({
      title: "Work through notes",
      scheduledDate: "2026-08-06"
    });
    context.setTime(new Date(2026, 7, 6, 9, 30));
    await context.taskRepository.startTask(task.id);

    const inProgressRecap =
      await context.dailyRecapRepository.getDailyRecap("2026-08-06");
    assert.deepEqual(inProgressRecap.accomplishedTasks, []);
    assert.deepEqual(
      inProgressRecap.stillOpenTasks.map(({ task: openTask }) => openTask.title),
      ["Work through notes"]
    );

    context.setTime(new Date(2026, 7, 7, 8, 0));
    await context.taskRepository.completeTask(task.id);
    const completionRecap =
      await context.dailyRecapRepository.getDailyRecap("2026-08-07");
    assert.deepEqual(
      completionRecap.accomplishedTasks.map((completedTask) => completedTask.title),
      ["Work through notes"]
    );
  });

  it("keeps fixed events factual and Recovery decisions separate from completion", async () => {
    const context = await createContext();
    const selectedDate = "2026-08-06";
    const completedTask = await context.taskRepository.createTask({
      title: "Completed task",
      scheduledDate: "2026-08-05"
    });
    const decisions = await Promise.all(
      ["Reschedule", "Delegate", "Remove", "Break down", "Keep", "Decide later"].map(
        (title) =>
          context.taskRepository.createTask({ title, scheduledDate: selectedDate })
      )
    );
    context.setTime(new Date(2026, 7, 6, 10, 30));
    await context.taskRepository.completeTask(completedTask.id);
    await context.calendarEventRepository.createEvent({
      title: "Dentist appointment",
      date: selectedDate,
      startTime: "13:00"
    });
    const session = await context.recoveryRepository.startSession(selectedDate);
    const itemFor = (taskId: string) =>
      session.items.find((item) => item.taskId === taskId)!.id;

    await context.recoveryRepository.rescheduleTask(itemFor(decisions[0]!.id), {
      scheduledDate: "2026-08-09"
    });
    await context.recoveryRepository.delegateTask(itemFor(decisions[1]!.id));
    await context.recoveryRepository.removeTask(itemFor(decisions[2]!.id));
    await context.recoveryRepository.breakDownTask(itemFor(decisions[3]!.id), {
      titles: ["First smaller step", "Second smaller step"]
    });
    await context.recoveryRepository.keepTask(itemFor(decisions[4]!.id));
    await context.recoveryRepository.skipTask(itemFor(decisions[5]!.id));
    await context.taskRepository.createTask({
      title: "Added after Recovery began",
      scheduledDate: selectedDate
    });

    const recap = await context.dailyRecapRepository.getDailyRecap(selectedDate);

    assert.deepEqual(
      recap.accomplishedTasks.map((task) => task.title),
      ["Completed task"]
    );
    assert.deepEqual(
      recap.fixedEvents.map((event) => event.title),
      ["Dentist appointment"]
    );
    assert.deepEqual(recap.recovery.decisionCounts, {
      keep: 1,
      reschedule: 1,
      break_down: 1,
      delegate: 1,
      remove: 1
    });
    assert.equal(recap.recovery.totalDecisionCount, 5);
    assert.equal(recap.recovery.waitingDecisionCount, 1);
    assert.deepEqual(
      recap.stillOpenTasks.map(({ task, reason }) => [task.title, reason]),
      [
        ["Decide later", "waiting_decision"],
        ["Keep", "kept_active"],
        ["Added after Recovery began", "scheduled"]
      ]
    );
    assert.equal(
      recap.encouragement,
      "You finished work and adjusted the rest of the plan."
    );
  });

  it("does not invent completion history for legacy completed tasks", async () => {
    const context = await createContext();
    const legacyTask = await context.taskRepository.createTask({
      title: "Legacy completed task",
      scheduledDate: "2026-08-06"
    });
    await context.taskStorage.updateTask({
      ...legacyTask,
      status: "completed",
      completedAt: null
    });

    const recap = await context.dailyRecapRepository.getDailyRecap("2026-08-06");

    assert.deepEqual(recap.accomplishedTasks, []);
    assert.deepEqual(recap.stillOpenTasks, []);
  });

  it("derives the same recap after database reinitialization", async () => {
    const first = await createContext();
    const selectedDate = "2026-08-06";
    const completedTask = await first.taskRepository.createTask({
      title: "Persisted accomplishment",
      scheduledDate: "2026-08-04"
    });
    await first.taskRepository.createTask({
      title: "Persisted recovery task",
      scheduledDate: selectedDate
    });
    first.setTime(new Date(2026, 7, 6, 16, 0));
    await first.taskRepository.completeTask(completedTask.id);
    const session = await first.recoveryRepository.startSession(selectedDate);
    await first.recoveryRepository.keepTask(session.items[0]!.id);

    const restoredDatabase = await createSqlJsDatabase(first.database.exportData());
    const restored = await createContext(restoredDatabase);
    const recap = await restored.dailyRecapRepository.getDailyRecap(selectedDate);

    assert.deepEqual(
      recap.accomplishedTasks.map((task) => task.title),
      ["Persisted accomplishment"]
    );
    assert.equal(recap.recovery.decisionCounts.keep, 1);
    assert.equal(recap.stillOpenTasks[0]?.reason, "kept_active");
  });
});

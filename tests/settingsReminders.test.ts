import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { initializeDatabase } from "../src/database/database";
import { CalendarEventRepository } from "../src/database/repositories/calendarEventRepository";
import { CalendarEventValidationError } from "../src/database/repositories/calendarEventErrors";
import { RecoveryRepository } from "../src/database/repositories/recoveryRepository";
import { SettingsRepository } from "../src/database/repositories/settingsRepository";
import { TaskRepository } from "../src/database/repositories/taskRepository";
import { TaskValidationError } from "../src/database/repositories/errors";
import { SqlCalendarEventStorage } from "../src/database/sqlCalendarEventStorage";
import { SqlRecoveryStorage } from "../src/database/sqlRecoveryStorage";
import { SqlSettingsStorage } from "../src/database/sqlSettingsStorage";
import { SqlTaskStorage } from "../src/database/sqlTaskStorage";
import { NotificationAdapter } from "../src/notifications/notificationAdapter";
import {
  buildTaskReminderRequests,
  getReminderTriggerDate
} from "../src/notifications/reminderRules";
import { ReminderService } from "../src/notifications/reminderService";
import { ReminderSynchronizer } from "../src/notifications/reminderSynchronizer";
import {
  removeReminder,
  upsertAbsoluteReminder
} from "../src/features/reminders/reminderEditorModel";
import {
  ReminderNotificationRequest,
  ReminderPermissionStatus
} from "../src/types/reminder";
import { CalendarEvent } from "../src/types/calendarEvent";
import { getTaskPlanningState, Task } from "../src/types/task";
import { createSqlJsDatabase } from "./helpers/sqlJsDatabase";

const now = new Date(2026, 7, 1, 8, 0, 0);

class FakeNotificationAdapter implements NotificationAdapter {
  permissionStatus: ReminderPermissionStatus = "granted";
  requestedPermissionStatus: ReminderPermissionStatus | null = null;
  readonly scheduled = new Map<string, ReminderNotificationRequest>();
  requestCount = 0;
  cancelAllCount = 0;

  async getPermissionStatus() {
    return this.permissionStatus;
  }

  async requestPermission() {
    this.requestCount += 1;
    this.permissionStatus = this.requestedPermissionStatus ?? this.permissionStatus;
    return this.permissionStatus;
  }

  async scheduleReminder(request: ReminderNotificationRequest) {
    this.scheduled.set(request.identifier, request);
  }

  async cancelReminder(identifier: string) {
    this.scheduled.delete(identifier);
  }

  async cancelAllReminders() {
    this.cancelAllCount += 1;
    this.scheduled.clear();
  }
}

class RecordingReminderSynchronizer implements ReminderSynchronizer {
  readonly tasks: Task[] = [];
  readonly events: CalendarEvent[] = [];

  async syncTaskReminder(task: Task) {
    this.tasks.push({ ...task });
  }

  async syncEventReminder(event: CalendarEvent) {
    this.events.push({ ...event });
  }
}

async function createReminderContext() {
  const database = await createSqlJsDatabase();
  await initializeDatabase(database);
  const taskStorage = new SqlTaskStorage(database);
  const eventStorage = new SqlCalendarEventStorage(database);
  const settingsRepository = new SettingsRepository(
    new SqlSettingsStorage(database),
    () => now
  );
  const adapter = new FakeNotificationAdapter();
  const service = new ReminderService(
    settingsRepository,
    taskStorage,
    eventStorage,
    adapter,
    () => now
  );
  let taskId = 0;
  let eventId = 0;
  const taskRepository = new TaskRepository(
    taskStorage,
    () => `reminder-task-${++taskId}`,
    () => now,
    service
  );
  const eventRepository = new CalendarEventRepository(
    eventStorage,
    () => `reminder-event-${++eventId}`,
    () => now,
    service
  );

  return {
    adapter,
    database,
    eventRepository,
    eventStorage,
    service,
    settingsRepository,
    taskRepository,
    taskStorage
  };
}

describe("settings and reminder foundation", () => {
  it("persists reminder settings through SQLite reinitialization", async () => {
    const { database, settingsRepository } = await createReminderContext();

    assert.deepEqual(await settingsRepository.getSettings(), {
      remindersEnabled: false,
      planningDayStart: "08:00",
      planningDayEnd: "20:00",
      transitionBufferMinutes: 15,
      maxSuggestedTaskMinutesPerDay: 180
    });
    await settingsRepository.setRemindersEnabled(true);

    const reopenedDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(reopenedDatabase);
    const reopenedRepository = new SettingsRepository(
      new SqlSettingsStorage(reopenedDatabase)
    );

    assert.deepEqual(await reopenedRepository.getSettings(), {
      remindersEnabled: true,
      planningDayStart: "08:00",
      planningDayEnd: "20:00",
      transitionBufferMinutes: 15,
      maxSuggestedTaskMinutesPerDay: 180
    });
  });

  it("persists the planning preferences used by the scheduling engine", async () => {
    const { database, settingsRepository } = await createReminderContext();

    await settingsRepository.setPlanningPreference("planningDayStart", "09:00");
    await settingsRepository.setPlanningPreference("planningDayEnd", "22:00");
    await settingsRepository.setPlanningPreference("transitionBufferMinutes", 30);
    await settingsRepository.setPlanningPreference("maxSuggestedTaskMinutesPerDay", 240);

    const reopenedDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(reopenedDatabase);
    const settings = await new SettingsRepository(
      new SqlSettingsStorage(reopenedDatabase)
    ).getSettings();

    assert.equal(settings.planningDayStart, "09:00");
    assert.equal(settings.planningDayEnd, "22:00");
    assert.equal(settings.transitionBufferMinutes, 30);
    assert.equal(settings.maxSuggestedTaskMinutesPerDay, 240);
  });

  it("keeps reminder intent while disabled and reconciles when enabled", async () => {
    const { adapter, service, taskRepository, taskStorage } =
      await createReminderContext();
    const task = await taskRepository.createTask({
      title: "Review the form",
      scheduledDate: "2026-08-06",
      scheduledTime: "10:00",
      reminderOffsets: [60, 15]
    });

    assert.equal(adapter.scheduled.size, 0);
    assert.deepEqual(task.reminderOffsets, [60, 15]);

    const enabledStatus = await service.setRemindersEnabled(true);

    assert.equal(enabledStatus.settings.remindersEnabled, true);
    assert.ok(adapter.scheduled.has(`adhd-calendar-task-${task.id}-60`));
    assert.ok(adapter.scheduled.has(`adhd-calendar-task-${task.id}-15`));

    await service.setRemindersEnabled(false);

    assert.equal(adapter.scheduled.size, 0);
    assert.deepEqual((await taskStorage.getTaskById(task.id))?.reminderOffsets, [60, 15]);
  });

  it("requests permission only when enabling and handles denial safely", async () => {
    const { adapter, service, settingsRepository } = await createReminderContext();
    adapter.permissionStatus = "undetermined";
    adapter.requestedPermissionStatus = "denied";

    const status = await service.setRemindersEnabled(true);

    assert.equal(adapter.requestCount, 1);
    assert.equal(status.permissionStatus, "denied");
    assert.equal((await settingsRepository.getSettings()).remindersEnabled, false);
    assert.ok(adapter.cancelAllCount > 0);
  });

  it("persists multiple task reminders and cancels all on completion", async () => {
    const { adapter, database, service, taskRepository, taskStorage } =
      await createReminderContext();
    await service.setRemindersEnabled(true);
    const task = await taskRepository.createTask({
      title: "Submit the application",
      scheduledDate: "2026-08-06",
      scheduledTime: "11:00",
      reminders: [
        { kind: "relative", offsetMinutes: 60 },
        { kind: "relative", offsetMinutes: 15 },
        { kind: "absolute", date: "2026-08-05", time: "16:45" }
      ]
    });

    assert.deepEqual((await taskStorage.getTaskById(task.id))?.reminders, task.reminders);
    assert.equal(adapter.scheduled.size, 3);
    assert.ok(adapter.scheduled.has(`adhd-calendar-task-${task.id}-60`));
    assert.ok(adapter.scheduled.has(`adhd-calendar-task-${task.id}-15`));
    assert.ok(
      adapter.scheduled.has(`adhd-calendar-task-${task.id}-absolute-2026-08-05-1645`)
    );

    const reopenedDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(reopenedDatabase);
    assert.deepEqual(
      (await new SqlTaskStorage(reopenedDatabase).getTaskById(task.id))?.reminders,
      task.reminders
    );

    const completed = await taskRepository.completeTask(task.id);

    assert.deepEqual(completed.reminders, task.reminders);
    assert.equal(adapter.scheduled.size, 0);
  });

  it("keeps multiple reminders independent from Flexible, Planned, and Scheduled placement", async () => {
    const { database, taskRepository } = await createReminderContext();
    const flexible = await taskRepository.createTask({
      title: "Flexible reminder task",
      reminders: [
        { kind: "absolute", date: "2026-08-04", time: "09:00" },
        { kind: "absolute", date: "2026-08-05", time: "16:30" }
      ]
    });
    const planned = await taskRepository.createTask({
      title: "Planned reminder task",
      scheduledDate: "2026-08-06",
      preferredTime: "14:00",
      reminders: [
        { kind: "absolute", date: "2026-08-05", time: "09:00" },
        { kind: "absolute", date: "2026-08-06", time: "12:30" }
      ]
    });
    const scheduled = await taskRepository.createTask({
      title: "Scheduled reminder task",
      scheduledDate: "2026-08-06",
      scheduledTime: "15:00",
      reminders: [
        { kind: "relative", offsetMinutes: 60 },
        { kind: "absolute", date: "2026-08-05", time: "18:00" }
      ]
    });

    assert.equal(getTaskPlanningState(flexible), "flexible");
    assert.equal(getTaskPlanningState(planned), "planned");
    assert.equal(planned.preferredTime, "14:00");
    assert.equal(getTaskPlanningState(scheduled), "scheduled");
    assert.deepEqual(
      [flexible.reminders.length, planned.reminders.length, scheduled.reminders.length],
      [2, 2, 2]
    );

    const reopenedDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(reopenedDatabase);
    const reopenedTasks = await new SqlTaskStorage(reopenedDatabase).getAllTasks();

    assert.deepEqual(
      reopenedTasks.map((task) => ({
        id: task.id,
        planningState: getTaskPlanningState(task),
        reminders: task.reminders
      })),
      [flexible, planned, scheduled].map((task) => ({
        id: task.id,
        planningState: getTaskPlanningState(task),
        reminders: task.reminders
      }))
    );
  });

  it("edits or removes one custom reminder without changing the others", async () => {
    const { adapter, service, taskRepository } = await createReminderContext();
    await service.setRemindersEnabled(true);
    const task = await taskRepository.createTask({
      title: "Independent custom reminders",
      reminders: [
        { kind: "absolute", date: "2026-08-04", time: "09:00" },
        { kind: "absolute", date: "2026-08-05", time: "16:30" }
      ]
    });
    const firstReminder = task.reminders[0]!;
    const secondReminder = task.reminders[1]!;
    const editedReminders = upsertAbsoluteReminder(
      task.reminders,
      "absolute-2026-08-04-0900",
      "2026-08-04",
      "10:15"
    );
    const edited = await taskRepository.updateTask(task.id, {
      ...task,
      reminders: editedReminders
    });

    assert.equal(
      adapter.scheduled.has(`adhd-calendar-task-${task.id}-absolute-2026-08-04-0900`),
      false
    );
    assert.ok(
      adapter.scheduled.has(`adhd-calendar-task-${task.id}-absolute-2026-08-04-1015`)
    );
    assert.ok(
      adapter.scheduled.has(`adhd-calendar-task-${task.id}-absolute-2026-08-05-1630`)
    );
    assert.equal(edited.reminders.length, 2);
    assert.deepEqual(
      edited.reminders.find(
        (reminder) => reminder.kind === "absolute" && reminder.date === "2026-08-05"
      ),
      secondReminder
    );

    const reduced = await taskRepository.updateTask(task.id, {
      ...edited,
      reminders: removeReminder(edited.reminders, secondReminder)
    });

    assert.equal(reduced.reminders.length, 1);
    assert.equal(
      adapter.scheduled.has(`adhd-calendar-task-${task.id}-absolute-2026-08-05-1630`),
      false
    );
    assert.deepEqual(firstReminder, {
      kind: "absolute",
      date: "2026-08-04",
      time: "09:00"
    });
  });

  it("persists and schedules multiple event reminders with distinct identities", async () => {
    const { adapter, database, eventRepository, eventStorage, service } =
      await createReminderContext();
    await service.setRemindersEnabled(true);

    const event = await eventRepository.createEvent({
      title: "Dentist",
      date: "2026-08-06",
      startTime: "09:30",
      reminders: [
        { kind: "relative", offsetMinutes: 1440 },
        { kind: "relative", offsetMinutes: 60 },
        { kind: "relative", offsetMinutes: 15 },
        { kind: "absolute", date: "2026-08-05", time: "18:30" }
      ]
    });

    assert.deepEqual((await eventStorage.getAllEvents())[0]?.reminders, event.reminders);
    assert.equal(adapter.scheduled.size, 4);
    assert.ok(adapter.scheduled.has(`adhd-calendar-event-${event.id}-1440`));
    assert.ok(adapter.scheduled.has(`adhd-calendar-event-${event.id}-60`));
    assert.ok(adapter.scheduled.has(`adhd-calendar-event-${event.id}-15`));
    assert.ok(
      adapter.scheduled.has(`adhd-calendar-event-${event.id}-absolute-2026-08-05-1830`)
    );

    const reopenedDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(reopenedDatabase);
    assert.deepEqual(
      (await new SqlCalendarEventStorage(reopenedDatabase).getAllEvents())[0]?.reminders,
      event.reminders
    );
  });

  it("rejects invalid reminder sets and a past reminded event", async () => {
    const { eventRepository, taskRepository } = await createReminderContext();

    await assert.rejects(
      () =>
        taskRepository.createTask({
          title: "Invalid offset",
          scheduledDate: "2026-08-06",
          scheduledTime: "09:00",
          reminderOffsets: [15, 15]
        }),
      (error) => error instanceof TaskValidationError && error.field === "reminderOffsets"
    );
    await assert.rejects(
      () =>
        taskRepository.createTask({
          title: "Too many reminders",
          scheduledDate: "2026-08-06",
          reminderOffsets: [1440, 60, 30, 15, 10, 0]
        }),
      (error) => error instanceof TaskValidationError && error.field === "reminderOffsets"
    );
    await assert.rejects(
      () =>
        eventRepository.createEvent({
          title: "Past event",
          date: "2026-07-31",
          startTime: "09:00",
          reminderOffsets: [0]
        }),
      (error) =>
        error instanceof CalendarEventValidationError && error.field === "reminderOffsets"
    );
  });

  it("reschedules every valid reminder and clears stale notification identities", async () => {
    const { adapter, service, taskRepository } = await createReminderContext();
    await service.setRemindersEnabled(true);
    const task = await taskRepository.createTask({
      title: "Prepare the packet",
      scheduledDate: "2026-08-06",
      scheduledTime: "10:00",
      reminderOffsets: [60, 15, 0]
    });
    const legacyIdentifier = `adhd-calendar-task-${task.id}`;
    const existingRequest = adapter.scheduled.get(`adhd-calendar-task-${task.id}-60`);
    assert.ok(existingRequest);
    adapter.scheduled.set(legacyIdentifier, {
      ...existingRequest,
      identifier: legacyIdentifier
    });

    const updated = await taskRepository.updateTask(task.id, {
      ...task,
      scheduledDate: "2026-08-07",
      scheduledTime: "14:00",
      reminders: [
        { kind: "relative", offsetMinutes: 1440 },
        { kind: "relative", offsetMinutes: 60 },
        { kind: "relative", offsetMinutes: 0 }
      ]
    });

    assert.deepEqual(updated.reminderOffsets, [1440, 60, 0]);
    assert.equal(adapter.scheduled.size, 3);
    assert.equal(adapter.scheduled.has(legacyIdentifier), false);
    assert.equal(adapter.scheduled.has(`adhd-calendar-task-${task.id}-15`), false);
    assert.ok(adapter.scheduled.has(`adhd-calendar-task-${task.id}-1440`));
    assert.ok(adapter.scheduled.has(`adhd-calendar-task-${task.id}-60`));
    assert.ok(adapter.scheduled.has(`adhd-calendar-task-${task.id}-0`));

    const flexible = await taskRepository.updateTask(task.id, {
      ...updated,
      scheduledDate: null,
      scheduledTime: null
    });
    assert.deepEqual(flexible.reminderOffsets, [1440, 60, 0]);
    assert.equal(adapter.scheduled.size, 0);
  });

  it("cancels every task reminder when the task is removed", async () => {
    const { adapter, service, taskRepository } = await createReminderContext();
    await service.setRemindersEnabled(true);
    const task = await taskRepository.createTask({
      title: "Optional preparation",
      scheduledDate: "2026-08-06",
      scheduledTime: "10:00",
      reminderOffsets: [60, 15]
    });
    assert.equal(adapter.scheduled.size, 2);

    const removed = await taskRepository.removeTask(task.id);
    assert.deepEqual(removed.reminderOffsets, [60, 15]);
    assert.equal(adapter.scheduled.size, 0);
  });

  it("builds reminder times from local calendar parts without UTC shifting", () => {
    const trigger = getReminderTriggerDate("2026-08-06", "00:10", 30);

    assert.ok(trigger);
    assert.equal(trigger.getFullYear(), 2026);
    assert.equal(trigger.getMonth(), 7);
    assert.equal(trigger.getDate(), 5);
    assert.equal(trigger.getHours(), 23);
    assert.equal(trigger.getMinutes(), 40);

    const [customRequest] = buildTaskReminderRequests({
      id: "local-wall-clock",
      title: "Keep local time",
      description: null,
      importance: "normal",
      color: "neutral",
      status: "not_started",
      parentTaskId: null,
      scheduledDate: null,
      scheduledTime: null,
      preferredTime: null,
      estimatedDurationMinutes: null,
      deadlineDate: null,
      deadlineTime: null,
      reminders: [{ kind: "absolute", date: "2026-08-06", time: "00:10" }],
      reminderOffsets: [],
      startedAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      completedAt: null,
      deletedAt: null
    });

    assert.ok(customRequest);
    assert.equal(customRequest.triggerDate.getDate(), 6);
    assert.equal(customRequest.triggerDate.getHours(), 0);
    assert.equal(customRequest.triggerDate.getMinutes(), 10);
  });

  it("synchronizes reminder metadata for every Recovery decision", async () => {
    const database = await createSqlJsDatabase();
    await initializeDatabase(database);
    const taskStorage = new SqlTaskStorage(database);
    let taskId = 0;
    let itemId = 0;
    let childId = 0;
    const taskRepository = new TaskRepository(
      taskStorage,
      () => `recovery-reminder-task-${++taskId}`,
      () => now
    );
    const synchronizer = new RecordingReminderSynchronizer();
    const recoveryRepository = new RecoveryRepository(
      new SqlRecoveryStorage(database),
      taskStorage,
      () => "recovery-reminder-session",
      () => `recovery-reminder-item-${++itemId}`,
      () => `recovery-reminder-child-${++childId}`,
      () => now,
      synchronizer
    );
    const titles = ["Keep", "Reschedule", "Break down", "Delegate", "Remove"];

    for (const title of titles) {
      await taskRepository.createTask({
        title,
        scheduledDate: "2026-08-06",
        scheduledTime: "10:00",
        reminderOffsets: [60, 15]
      });
    }

    const session = await recoveryRepository.startSession("2026-08-06");
    const itemFor = (title: string) =>
      session.items.find((item) => item.originalTitle === title)!;

    assert.ok(
      session.items.every(
        (item) => JSON.stringify(item.originalReminderOffsets) === "[60,15]"
      )
    );

    await recoveryRepository.keepTask(itemFor("Keep").id);
    await recoveryRepository.rescheduleTask(itemFor("Reschedule").id, {
      scheduledDate: "2026-08-09",
      scheduledTime: "14:30"
    });
    await recoveryRepository.breakDownTask(itemFor("Break down").id, {
      titles: ["First smaller step", "Second smaller step"]
    });
    await recoveryRepository.delegateTask(itemFor("Delegate").id);
    await recoveryRepository.removeTask(itemFor("Remove").id);

    const storedTasks = await taskStorage.getAllTasks();
    const byTitle = (title: string) => storedTasks.find((task) => task.title === title)!;

    assert.deepEqual(byTitle("Keep").reminderOffsets, [60, 15]);
    assert.deepEqual(byTitle("Reschedule").reminderOffsets, [60, 15]);
    assert.equal(byTitle("Reschedule").scheduledDate, "2026-08-09");
    assert.equal(byTitle("Reschedule").scheduledTime, "14:30");
    assert.deepEqual(byTitle("Break down").reminderOffsets, [60, 15]);
    assert.deepEqual(byTitle("Delegate").reminderOffsets, [60, 15]);
    assert.deepEqual(byTitle("Remove").reminderOffsets, [60, 15]);
    assert.ok(
      storedTasks
        .filter((task) => task.id.startsWith("recovery-reminder-child-"))
        .every((task) => task.reminderOffsets.length === 0)
    );
    assert.ok(synchronizer.tasks.length >= 7);
  });
});

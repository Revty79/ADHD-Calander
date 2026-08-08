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
import { getReminderTriggerDate } from "../src/notifications/reminderRules";
import { ReminderService } from "../src/notifications/reminderService";
import { ReminderSynchronizer } from "../src/notifications/reminderSynchronizer";
import {
  ReminderNotificationRequest,
  ReminderPermissionStatus
} from "../src/types/reminder";
import { CalendarEvent } from "../src/types/calendarEvent";
import { Task } from "../src/types/task";
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
      reminderOffsetMinutes: 10
    });

    assert.equal(adapter.scheduled.size, 0);
    assert.equal(task.reminderOffsetMinutes, 10);

    const enabledStatus = await service.setRemindersEnabled(true);

    assert.equal(enabledStatus.settings.remindersEnabled, true);
    assert.ok(adapter.scheduled.has(`adhd-calendar-task-${task.id}`));

    await service.setRemindersEnabled(false);

    assert.equal(adapter.scheduled.size, 0);
    assert.equal((await taskStorage.getTaskById(task.id))?.reminderOffsetMinutes, 10);
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

  it("persists task reminder metadata and cancels it on completion", async () => {
    const { adapter, database, service, taskRepository, taskStorage } =
      await createReminderContext();
    await service.setRemindersEnabled(true);
    const task = await taskRepository.createTask({
      title: "Submit the application",
      scheduledDate: "2026-08-06",
      scheduledTime: "11:00",
      reminderOffsetMinutes: 30
    });

    assert.equal((await taskStorage.getTaskById(task.id))?.reminderOffsetMinutes, 30);
    assert.ok(adapter.scheduled.has(`adhd-calendar-task-${task.id}`));

    const reopenedDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(reopenedDatabase);
    assert.equal(
      (await new SqlTaskStorage(reopenedDatabase).getTaskById(task.id))
        ?.reminderOffsetMinutes,
      30
    );

    const completed = await taskRepository.completeTask(task.id);

    assert.equal(completed.reminderOffsetMinutes, null);
    assert.equal(adapter.scheduled.has(`adhd-calendar-task-${task.id}`), false);
  });

  it("persists and schedules one event reminder", async () => {
    const { adapter, database, eventRepository, eventStorage, service } =
      await createReminderContext();
    await service.setRemindersEnabled(true);

    const event = await eventRepository.createEvent({
      title: "Dentist",
      date: "2026-08-06",
      startTime: "09:30",
      reminderOffsetMinutes: 60
    });

    assert.equal((await eventStorage.getAllEvents())[0]?.reminderOffsetMinutes, 60);
    assert.ok(adapter.scheduled.has(`adhd-calendar-event-${event.id}`));

    const reopenedDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(reopenedDatabase);
    assert.equal(
      (await new SqlCalendarEventStorage(reopenedDatabase).getAllEvents())[0]
        ?.reminderOffsetMinutes,
      60
    );
  });

  it("rejects invalid, incomplete, and past reminder times", async () => {
    const { eventRepository, taskRepository } = await createReminderContext();

    await assert.rejects(
      () =>
        taskRepository.createTask({
          title: "Invalid offset",
          scheduledDate: "2026-08-06",
          scheduledTime: "09:00",
          reminderOffsetMinutes: 15
        }),
      (error) =>
        error instanceof TaskValidationError && error.field === "reminderOffsetMinutes"
    );
    await assert.rejects(
      () =>
        taskRepository.createTask({
          title: "Missing time",
          scheduledDate: "2026-08-06",
          reminderOffsetMinutes: 10
        }),
      (error) =>
        error instanceof TaskValidationError && error.field === "reminderOffsetMinutes"
    );
    await assert.rejects(
      () =>
        eventRepository.createEvent({
          title: "Past event",
          date: "2026-07-31",
          startTime: "09:00",
          reminderOffsetMinutes: 0
        }),
      (error) =>
        error instanceof CalendarEventValidationError &&
        error.field === "reminderOffsetMinutes"
    );
  });

  it("builds reminder times from local calendar parts without UTC shifting", () => {
    const trigger = getReminderTriggerDate("2026-08-06", "00:10", 30);

    assert.ok(trigger);
    assert.equal(trigger.getFullYear(), 2026);
    assert.equal(trigger.getMonth(), 7);
    assert.equal(trigger.getDate(), 5);
    assert.equal(trigger.getHours(), 23);
    assert.equal(trigger.getMinutes(), 40);
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
        reminderOffsetMinutes: 10
      });
    }

    const session = await recoveryRepository.startSession("2026-08-06");
    const itemFor = (title: string) =>
      session.items.find((item) => item.originalTitle === title)!;

    assert.ok(session.items.every((item) => item.originalReminderOffsetMinutes === 10));

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

    assert.equal(byTitle("Keep").reminderOffsetMinutes, null);
    assert.equal(byTitle("Reschedule").reminderOffsetMinutes, 10);
    assert.equal(byTitle("Reschedule").scheduledDate, "2026-08-09");
    assert.equal(byTitle("Reschedule").scheduledTime, "14:30");
    assert.equal(byTitle("Break down").reminderOffsetMinutes, null);
    assert.equal(byTitle("Delegate").reminderOffsetMinutes, null);
    assert.equal(byTitle("Remove").reminderOffsetMinutes, null);
    assert.ok(
      storedTasks
        .filter((task) => task.id.startsWith("recovery-reminder-child-"))
        .every((task) => task.reminderOffsetMinutes === null)
    );
    assert.ok(synchronizer.tasks.length >= 7);
  });
});

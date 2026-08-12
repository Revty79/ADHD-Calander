import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { initializeDatabase } from "../src/database/database";
import { migrations } from "../src/database/migrations";
import { CalendarEventRepository } from "../src/database/repositories/calendarEventRepository";
import { SettingsRepository } from "../src/database/repositories/settingsRepository";
import { TaskRepository } from "../src/database/repositories/taskRepository";
import { SqlCalendarEventStorage } from "../src/database/sqlCalendarEventStorage";
import { SqlSettingsStorage } from "../src/database/sqlSettingsStorage";
import { SqlTaskStorage } from "../src/database/sqlTaskStorage";
import {
  expandCalendarEventForRange,
  getCalendarOccurrenceId
} from "../src/features/calendar/recurrence";
import { NotificationAdapter } from "../src/notifications/notificationAdapter";
import { ReminderService } from "../src/notifications/reminderService";
import {
  ReminderNotificationRequest,
  ReminderPermissionStatus
} from "../src/types/reminder";
import { CalendarEvent, CalendarRecurrenceRule } from "../src/types/calendarEvent";
import { createSqlJsDatabase } from "./helpers/sqlJsDatabase";

const timestamp = "2026-01-01T15:00:00.000Z";

describe("calendar recurrence expansion", () => {
  it("expands daily and every-two-day series only inside the requested range", () => {
    assert.deepEqual(
      dates(expand(createEvent({ recurrence: daily(1) }), "2026-08-10", "2026-08-14")),
      ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"]
    );
    assert.deepEqual(
      dates(expand(createEvent({ recurrence: daily(2) }), "2026-08-10", "2026-08-18")),
      ["2026-08-10", "2026-08-12", "2026-08-14", "2026-08-16", "2026-08-18"]
    );
  });

  it("supports weekly weekdays and multi-week intervals", () => {
    const weekdays: CalendarRecurrenceRule = {
      frequency: "weekly",
      interval: 1,
      weekdays: [1, 3, 5],
      end: { kind: "never" }
    };
    const everyTwoWeeks: CalendarRecurrenceRule = {
      frequency: "weekly",
      interval: 2,
      weekdays: [1],
      end: { kind: "never" }
    };

    assert.deepEqual(
      dates(expand(createEvent({ recurrence: weekdays }), "2026-08-10", "2026-08-21")),
      ["2026-08-10", "2026-08-12", "2026-08-14", "2026-08-17", "2026-08-19", "2026-08-21"]
    );
    assert.deepEqual(
      dates(
        expand(createEvent({ recurrence: everyTwoWeeks }), "2026-08-10", "2026-09-07")
      ),
      ["2026-08-10", "2026-08-24", "2026-09-07"]
    );
  });

  it("supports same-date, second-weekday, and last-weekday monthly patterns", () => {
    const sameDate = createEvent({
      date: "2026-01-31",
      recurrence: {
        frequency: "monthly",
        interval: 1,
        monthlyPattern: { kind: "same_date" },
        end: { kind: "never" }
      }
    });
    const secondTuesday = createEvent({
      date: "2026-08-11",
      recurrence: {
        frequency: "monthly",
        interval: 1,
        monthlyPattern: { kind: "ordinal_weekday", ordinal: 2, weekday: 2 },
        end: { kind: "never" }
      }
    });
    const lastFriday = createEvent({
      date: "2026-08-28",
      recurrence: {
        frequency: "monthly",
        interval: 1,
        monthlyPattern: { kind: "ordinal_weekday", ordinal: -1, weekday: 5 },
        end: { kind: "never" }
      }
    });

    assert.deepEqual(dates(expand(sameDate, "2026-01-01", "2026-03-31")), [
      "2026-01-31",
      "2026-03-31"
    ]);
    assert.deepEqual(dates(expand(secondTuesday, "2026-08-01", "2026-10-31")), [
      "2026-08-11",
      "2026-09-08",
      "2026-10-13"
    ]);
    assert.deepEqual(dates(expand(lastFriday, "2026-08-01", "2026-10-31")), [
      "2026-08-28",
      "2026-09-25",
      "2026-10-30"
    ]);
  });

  it("supports yearly intervals and skips leap day in non-leap years", () => {
    const anniversary = createEvent({ date: "2026-08-14", recurrence: yearly(2) });
    const leapDay = createEvent({ date: "2024-02-29", recurrence: yearly(1) });

    assert.deepEqual(dates(expand(anniversary, "2026-01-01", "2031-12-31")), [
      "2026-08-14",
      "2028-08-14",
      "2030-08-14"
    ]);
    assert.deepEqual(dates(expand(leapDay, "2024-01-01", "2030-12-31")), [
      "2024-02-29",
      "2028-02-29"
    ]);
  });

  it("honors date and occurrence-count end conditions including skipped months", () => {
    const untilDate = createEvent({
      recurrence: { ...daily(1), end: { kind: "on_date", date: "2026-08-12" } }
    });
    const afterCount = createEvent({
      recurrence: { ...daily(1), end: { kind: "after_count", count: 3 } }
    });
    const monthEnd = createEvent({
      date: "2026-01-31",
      recurrence: {
        frequency: "monthly",
        interval: 1,
        monthlyPattern: { kind: "same_date" },
        end: { kind: "after_count", count: 2 }
      }
    });

    assert.deepEqual(dates(expand(untilDate, "2026-08-01", "2026-08-20")), [
      "2026-08-10",
      "2026-08-11",
      "2026-08-12"
    ]);
    assert.deepEqual(dates(expand(afterCount, "2026-08-01", "2026-08-20")), [
      "2026-08-10",
      "2026-08-11",
      "2026-08-12"
    ]);
    assert.deepEqual(dates(expand(monthEnd, "2026-01-01", "2026-05-31")), [
      "2026-01-31",
      "2026-03-31"
    ]);
  });

  it("keeps wall-clock times and local dates stable across DST and long-lived series", () => {
    const dstSeries = createEvent({
      date: "2026-03-07",
      startTime: "09:15",
      recurrence: daily(1)
    });
    const dstOccurrences = expand(dstSeries, "2026-03-07", "2026-03-10");
    const oldSeries = createEvent({ date: "1900-01-01", recurrence: daily(1) });
    const oneMonth = expand(oldSeries, "2026-08-01", "2026-08-31");

    assert.deepEqual(dates(dstOccurrences), [
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
      "2026-03-10"
    ]);
    assert.deepEqual(
      [...new Set(dstOccurrences.map((event) => event.startTime))],
      ["09:15"]
    );
    assert.equal(oneMonth.length, 31);
  });
});

describe("calendar recurrence repository workflows", () => {
  it("persists default and custom task/event colors and edits them without replacing identity", async () => {
    const { database, eventRepository, taskRepository } = await createRepositoryContext();
    const defaultTask = await taskRepository.createTask({ title: "Default task" });
    const coloredTask = await taskRepository.createTask({
      title: "Colored task",
      color: "blue"
    });
    const defaultEvent = await eventRepository.createEvent({
      title: "Default event",
      date: "2026-08-10",
      startTime: "09:00"
    });
    const coloredEvent = await eventRepository.createEvent({
      title: "Colored event",
      date: "2026-08-11",
      startTime: "09:00",
      color: "rose"
    });
    const updatedTask = await taskRepository.updateTask(coloredTask.id, {
      title: coloredTask.title,
      color: "green"
    });
    const updatedEvent = await eventRepository.updateEvent(
      coloredEvent.id,
      coloredEvent.date,
      "all",
      { ...coloredEvent, color: "lavender" }
    );

    assert.equal(defaultTask.color, "neutral");
    assert.equal(defaultEvent.color, "neutral");
    assert.equal(updatedTask.id, coloredTask.id);
    assert.equal(updatedTask.color, "green");
    assert.equal(updatedEvent.seriesId, coloredEvent.id);
    assert.equal(updatedEvent.color, "lavender");

    const reopenedDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(reopenedDatabase);
    assert.equal(
      (await new SqlTaskStorage(reopenedDatabase).getTaskById(coloredTask.id))?.color,
      "green"
    );
    assert.equal(
      (
        await new CalendarEventRepository(
          new SqlCalendarEventStorage(reopenedDatabase)
        ).getEventsForDate("2026-08-11")
      )[0]?.color,
      "lavender"
    );
  });

  it("edits and removes one occurrence while preserving the series", async () => {
    const { database, eventRepository } = await createRepositoryContext();
    const series = await eventRepository.createEvent({
      title: "Daily check-in",
      date: "2026-08-10",
      startTime: "10:00",
      recurrence: daily(1),
      color: "blue",
      reminders: [{ kind: "relative", offsetMinutes: 15 }]
    });

    await eventRepository.updateEvent(series.id, "2026-08-11", "this", {
      ...series,
      title: "Moved check-in",
      date: "2026-08-12",
      startTime: "12:00",
      color: "amber",
      reminders: [{ kind: "relative", offsetMinutes: 0 }]
    });
    await eventRepository.deleteEvent(series.id, "2026-08-13", "this");

    assert.deepEqual(await eventRepository.getEventsForDate("2026-08-11"), []);
    const augustTwelfth = await eventRepository.getEventsForDate("2026-08-12");
    assert.deepEqual(
      augustTwelfth.map((event) => event.title),
      ["Daily check-in", "Moved check-in"]
    );
    assert.equal(
      augustTwelfth.find((event) => event.title === "Moved check-in")?.color,
      "amber"
    );
    assert.deepEqual(await eventRepository.getEventsForDate("2026-08-13"), []);

    const reopenedDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(reopenedDatabase);
    const reopened = new CalendarEventRepository(
      new SqlCalendarEventStorage(reopenedDatabase)
    );
    assert.deepEqual(
      (await reopened.getEventsForDate("2026-08-12")).map((event) => event.title),
      ["Daily check-in", "Moved check-in"]
    );
    assert.deepEqual(await reopened.getEventsForDate("2026-08-13"), []);
  });

  it("splits this-and-future edits and deletions without rewriting past occurrences", async () => {
    const { eventRepository } = await createRepositoryContext();
    const original = await eventRepository.createEvent({
      title: "Original series",
      date: "2026-08-10",
      startTime: "10:00",
      recurrence: daily(1)
    });
    const future = await eventRepository.updateEvent(
      original.id,
      "2026-08-14",
      "future",
      {
        ...original,
        title: "Future series",
        date: "2026-08-14",
        recurrence: daily(2),
        color: "green"
      }
    );

    assert.deepEqual(
      (await eventRepository.getEventsForRange("2026-08-10", "2026-08-18")).map(
        (event) => [event.date, event.title]
      ),
      [
        ["2026-08-10", "Original series"],
        ["2026-08-11", "Original series"],
        ["2026-08-12", "Original series"],
        ["2026-08-13", "Original series"],
        ["2026-08-14", "Future series"],
        ["2026-08-16", "Future series"],
        ["2026-08-18", "Future series"]
      ]
    );

    await eventRepository.deleteEvent(future.seriesId, "2026-08-18", "future");
    assert.deepEqual(
      (await eventRepository.getEventsForRange("2026-08-14", "2026-08-22")).map(
        (event) => event.date
      ),
      ["2026-08-14", "2026-08-16"]
    );
  });

  it("edits and deletes an entire series only after an explicit all scope", async () => {
    const { eventRepository } = await createRepositoryContext();
    const series = await eventRepository.createEvent({
      title: "Weekly meeting",
      date: "2026-08-10",
      startTime: "09:00",
      recurrence: {
        frequency: "weekly",
        interval: 1,
        weekdays: [1],
        end: { kind: "never" }
      }
    });
    await eventRepository.updateEvent(series.id, "2026-08-17", "all", {
      ...series,
      title: "Renamed meeting",
      date: "2026-08-17",
      color: "rose"
    });

    assert.deepEqual(
      (await eventRepository.getEventsForRange("2026-08-10", "2026-08-24")).map(
        (event) => [event.title, event.color]
      ),
      [
        ["Renamed meeting", "rose"],
        ["Renamed meeting", "rose"],
        ["Renamed meeting", "rose"]
      ]
    );
    await eventRepository.deleteEvent(series.id, "2026-08-17", "all");
    assert.deepEqual(
      await eventRepository.getEventsForRange("2026-08-10", "2026-09-30"),
      []
    );
  });

  it("upgrades a version-10 SQLite database without losing normal events or tasks", async () => {
    const database = await createSqlJsDatabase();
    await database.execAsync(
      "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at TEXT NOT NULL);"
    );
    for (const migration of migrations.filter((item) => item.version <= 10)) {
      await migration.up(database);
      await database.runAsync(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);",
        migration.version,
        migration.name,
        timestamp
      );
    }
    await database.runAsync(
      "INSERT INTO tasks (id, title, description, importance, status, scheduled_date, scheduled_time, reminder_offsets, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
      "v10-task",
      "Existing task",
      null,
      "normal",
      "not_started",
      null,
      null,
      "[]",
      timestamp,
      timestamp,
      null
    );
    await database.runAsync(
      "INSERT INTO calendar_events (id, title, kind, date, start_time, end_time, duration_minutes, notes, reminder_offsets, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
      "v10-event",
      "Existing event",
      "fixed",
      "2026-08-10",
      "09:00",
      null,
      30,
      null,
      "[]",
      timestamp,
      timestamp
    );

    await initializeDatabase(database);
    const task = await new SqlTaskStorage(database).getTaskById("v10-task");
    const event = (
      await new CalendarEventRepository(
        new SqlCalendarEventStorage(database)
      ).getEventsForDate("2026-08-10")
    )[0];
    const latest = await database.getFirstAsync<{ version: number }>(
      "SELECT MAX(version) AS version FROM schema_migrations;"
    );

    assert.equal(latest?.version, 11);
    assert.equal(task?.title, "Existing task");
    assert.equal(task?.color, "neutral");
    assert.equal(event?.title, "Existing event");
    assert.equal(event?.color, "neutral");
    assert.equal(event?.isRecurring, false);
  });
});

describe("recurring reminder reconciliation", () => {
  it("schedules bounded unique relative reminders and resynchronizes an exception", async () => {
    const database = await createSqlJsDatabase();
    await initializeDatabase(database);
    const taskStorage = new SqlTaskStorage(database);
    const eventStorage = new SqlCalendarEventStorage(database);
    const settings = new SettingsRepository(
      new SqlSettingsStorage(database),
      () => new Date(2026, 7, 1, 8)
    );
    const adapter = new RecordingNotificationAdapter();
    const service = new ReminderService(
      settings,
      taskStorage,
      eventStorage,
      adapter,
      () => new Date(2026, 7, 1, 8)
    );
    const repository = new CalendarEventRepository(
      eventStorage,
      () => "reminder-series",
      () => new Date(2026, 7, 1, 8),
      service
    );
    await service.setRemindersEnabled(true);
    const series = await repository.createEvent({
      title: "Recurring appointment",
      date: "2026-08-02",
      startTime: "10:00",
      recurrence: daily(1),
      reminders: [
        { kind: "relative", offsetMinutes: 60 },
        { kind: "relative", offsetMinutes: 15 }
      ]
    });

    assert.equal(adapter.scheduled.size, 180);
    const firstIdentifier = `adhd-calendar-event-${getCalendarOccurrenceId(series.id, "2026-08-02")}-60`;
    assert.equal(adapter.scheduled.get(firstIdentifier)?.triggerDate.getHours(), 9);

    await repository.updateEvent(series.id, "2026-08-03", "this", {
      ...series,
      date: "2026-08-03",
      startTime: "12:00",
      reminders: [{ kind: "relative", offsetMinutes: 0 }]
    });
    assert.equal(
      adapter.scheduled.has(
        `adhd-calendar-event-${getCalendarOccurrenceId(series.id, "2026-08-03")}-60`
      ),
      false
    );
    assert.equal(
      adapter.scheduled.has(
        `adhd-calendar-event-${getCalendarOccurrenceId(series.id, "2026-08-03")}-15`
      ),
      false
    );
    assert.equal(
      adapter.scheduled.has(
        `adhd-calendar-event-${getCalendarOccurrenceId(series.id, "2026-08-03")}-0`
      ),
      true
    );
    assert.equal(adapter.scheduled.size, 179);
  });
});

function expand(
  event: CalendarEvent,
  startDate: CalendarEvent["date"],
  endDate: CalendarEvent["date"]
) {
  return expandCalendarEventForRange(event, [], startDate, endDate);
}

function dates(events: ReturnType<typeof expand>) {
  return events.map((event) => event.date);
}

function createEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "series",
    title: "Recurring event",
    kind: "fixed",
    date: "2026-08-10",
    startTime: "09:00",
    endTime: null,
    durationMinutes: 30,
    notes: null,
    color: "neutral",
    reminders: [],
    reminderOffsets: [],
    recurrence: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  };
}

function daily(interval: number): CalendarRecurrenceRule {
  return { frequency: "daily", interval, end: { kind: "never" } };
}

function yearly(interval: number): CalendarRecurrenceRule {
  return { frequency: "yearly", interval, end: { kind: "never" } };
}

async function createRepositoryContext() {
  const database = await createSqlJsDatabase();
  await initializeDatabase(database);
  let eventId = 0;
  let taskId = 0;
  return {
    database,
    eventRepository: new CalendarEventRepository(
      new SqlCalendarEventStorage(database),
      () => `series-${++eventId}`,
      () => new Date(timestamp)
    ),
    taskRepository: new TaskRepository(
      new SqlTaskStorage(database),
      () => `task-${++taskId}`,
      () => new Date(timestamp)
    )
  };
}

class RecordingNotificationAdapter implements NotificationAdapter {
  readonly scheduled = new Map<string, ReminderNotificationRequest>();
  async getPermissionStatus(): Promise<ReminderPermissionStatus> {
    return "granted";
  }
  async requestPermission(): Promise<ReminderPermissionStatus> {
    return "granted";
  }
  async scheduleReminder(request: ReminderNotificationRequest): Promise<void> {
    this.scheduled.set(request.identifier, request);
  }
  async cancelReminder(identifier: string): Promise<void> {
    this.scheduled.delete(identifier);
  }
  async cancelAllReminders(): Promise<void> {
    this.scheduled.clear();
  }
}

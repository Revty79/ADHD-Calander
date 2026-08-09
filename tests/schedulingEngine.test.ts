import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { initializeDatabase } from "../src/database/database";
import { CalendarEventRepository } from "../src/database/repositories/calendarEventRepository";
import { SettingsRepository } from "../src/database/repositories/settingsRepository";
import { TaskRepository } from "../src/database/repositories/taskRepository";
import { SqlCalendarEventStorage } from "../src/database/sqlCalendarEventStorage";
import { SqlSettingsStorage } from "../src/database/sqlSettingsStorage";
import { SqlTaskStorage } from "../src/database/sqlTaskStorage";
import { generateSchedulingSuggestions } from "../src/features/scheduling/scheduler";
import {
  SchedulingService,
  SchedulingSuggestionUnavailableError
} from "../src/features/scheduling/schedulingService";
import { SchedulingEngineInput } from "../src/features/scheduling/types";
import { ReminderSynchronizer } from "../src/notifications/reminderSynchronizer";
import { CalendarEvent } from "../src/types/calendarEvent";
import { PlanningPreferences } from "../src/types/settings";
import { Task } from "../src/types/task";
import { createSqlJsDatabase } from "./helpers/sqlJsDatabase";

const timestamp = "2026-08-10T13:00:00.000Z";
const now = new Date(2026, 7, 10, 7, 0, 0);
const defaultPreferences: PlanningPreferences = {
  planningDayStart: "08:00",
  planningDayEnd: "20:00",
  transitionBufferMinutes: 15,
  maxSuggestedTaskMinutesPerDay: 180
};

describe("rule-based scheduling engine", () => {
  it("blocks fixed events and respects transition buffers", () => {
    const suggestions = generate({
      task: createTask({ estimatedDurationMinutes: 30 }),
      events: [
        createEvent({ startTime: "09:00", endTime: "10:00", durationMinutes: 60 })
      ],
      preferences: {
        ...defaultPreferences,
        planningDayEnd: "12:00"
      },
      horizonDays: 1
    });

    assert.deepEqual(
      suggestions.map(({ startTime, endTime }) => [startTime, endTime]),
      [
        ["08:00", "08:30"],
        ["10:15", "10:45"]
      ]
    );
    assert.ok(
      suggestions.every(
        (suggestion) => suggestion.endTime <= "08:45" || suggestion.startTime >= "10:15"
      )
    );
  });

  it("blocks existing timed tasks without applying a fixed-event buffer", () => {
    const suggestions = generate({
      task: createTask({ estimatedDurationMinutes: 30 }),
      tasks: [
        createTask({
          id: "existing-task",
          scheduledDate: "2026-08-10",
          scheduledTime: "08:00",
          estimatedDurationMinutes: 60
        })
      ],
      preferences: { ...defaultPreferences, planningDayEnd: "10:00" },
      horizonDays: 1
    });

    assert.equal(suggestions[0]?.startTime, "09:00");
  });

  it("allows an exact fit and rejects a task barely too long for a buffered gap", () => {
    const preferences: PlanningPreferences = {
      ...defaultPreferences,
      planningDayEnd: "09:00"
    };
    const input = {
      events: [
        createEvent({ startTime: "09:00", endTime: "10:00", durationMinutes: 60 })
      ],
      preferences,
      horizonDays: 1
    };

    assert.deepEqual(
      generate({ ...input, task: createTask({ estimatedDurationMinutes: 45 }) }).map(
        ({ startTime, endTime }) => [startTime, endTime]
      ),
      [["08:00", "08:45"]]
    );
    assert.deepEqual(
      generate({ ...input, task: createTask({ estimatedDurationMinutes: 46 }) }),
      []
    );
  });

  it("keeps suggestions inside planning-day boundaries", () => {
    const exact = generate({
      task: createTask({ estimatedDurationMinutes: 120 }),
      preferences: { ...defaultPreferences, planningDayEnd: "10:00" },
      horizonDays: 1
    });
    const tooLong = generate({
      task: createTask({ estimatedDurationMinutes: 121 }),
      preferences: { ...defaultPreferences, planningDayEnd: "10:00" },
      horizonDays: 1
    });

    assert.deepEqual(
      exact.map(({ startTime, endTime }) => [startTime, endTime]),
      [["08:00", "10:00"]]
    );
    assert.deepEqual(tooLong, []);
  });

  it("uses the deadline as a hard local-date boundary", () => {
    const suggestions = generate({
      task: createTask({
        scheduledDate: "2026-08-10",
        plannedTimePreference: "evening",
        estimatedDurationMinutes: 30,
        deadlineDate: "2026-08-11"
      }),
      horizonDays: 4,
      maximumSuggestions: 2
    });

    assert.deepEqual(
      suggestions.map((suggestion) => suggestion.date),
      ["2026-08-10", "2026-08-11"]
    );
    assert.ok(suggestions.every((suggestion) => suggestion.date <= "2026-08-11"));
  });

  it("preserves local calendar strings without UTC conversion", () => {
    const suggestions = generate({
      task: createTask({ estimatedDurationMinutes: 30 }),
      startDate: "2026-08-10",
      now: new Date(2026, 7, 10, 8, 7, 0),
      horizonDays: 1
    });

    assert.equal(suggestions[0]?.date, "2026-08-10");
    assert.equal(suggestions[0]?.startTime, "08:15");
    assert.equal(suggestions[0]?.endTime, "08:45");
  });

  it("ranks preferred time-of-day slots before valid non-preferred slots", () => {
    const suggestions = generate({
      task: createTask({
        scheduledDate: "2026-08-10",
        plannedTimePreference: "afternoon",
        estimatedDurationMinutes: 45
      }),
      horizonDays: 1,
      maximumSuggestions: 3
    });

    assert.equal(suggestions[0]?.startTime, "12:00");
    assert.match(suggestions[0]?.explanation ?? "", /afternoon preference/);
    assert.equal(suggestions[1]?.startTime, "08:00");
  });

  it("returns valid alternatives when the preferred period is unavailable", () => {
    const suggestions = generate({
      task: createTask({
        scheduledDate: "2026-08-10",
        plannedTimePreference: "afternoon",
        estimatedDurationMinutes: 30
      }),
      events: [
        createEvent({
          startTime: "11:45",
          endTime: "17:15",
          durationMinutes: 330
        })
      ],
      horizonDays: 1
    });

    assert.ok(suggestions.length > 0);
    assert.ok(
      suggestions.every(
        (suggestion) => suggestion.endTime <= "11:30" || suggestion.startTime >= "17:30"
      )
    );
    assert.ok(
      suggestions.every(
        (suggestion) => suggestion.startTime < "12:00" || suggestion.startTime >= "17:00"
      )
    );
    assert.match(suggestions[0]?.explanation ?? "", /fallback/);
  });

  it("never lets a soft preference override planning boundaries", () => {
    const suggestions = generate({
      task: createTask({
        scheduledDate: "2026-08-10",
        plannedTimePreference: "evening",
        estimatedDurationMinutes: 60
      }),
      preferences: {
        ...defaultPreferences,
        planningDayStart: "09:00",
        planningDayEnd: "16:00"
      },
      horizonDays: 1
    });

    assert.ok(suggestions.length > 0);
    assert.ok(
      suggestions.every(
        (suggestion) => suggestion.startTime >= "09:00" && suggestion.endTime <= "16:00"
      )
    );
  });

  it("ranks a reasonable lower-load day before a busier day", () => {
    const suggestions = generate({
      task: createTask({ estimatedDurationMinutes: 30 }),
      events: [
        createEvent({
          date: "2026-08-10",
          startTime: "10:00",
          endTime: "12:00",
          durationMinutes: 120
        })
      ],
      horizonDays: 2
    });

    assert.equal(suggestions[0]?.date, "2026-08-11");
    assert.equal(suggestions[0]?.dailyLoad.totalScheduledMinutes, 0);
    assert.equal(suggestions[1]?.dailyLoad.totalScheduledMinutes, 120);
  });

  it("returns non-overlapping suggestions across multiple fixed events", () => {
    const suggestions = generate({
      task: createTask({ estimatedDurationMinutes: 30 }),
      events: [
        createEvent({ startTime: "09:00", endTime: "10:00", durationMinutes: 60 }),
        createEvent({
          id: "event-2",
          startTime: "12:00",
          endTime: "13:00",
          durationMinutes: 60
        })
      ],
      preferences: { ...defaultPreferences, planningDayEnd: "14:00" },
      horizonDays: 1
    });

    assert.equal(suggestions.length, 3);
    for (let index = 1; index < suggestions.length; index += 1) {
      assert.ok(suggestions[index - 1]!.endTime <= suggestions[index]!.startTime);
    }
  });

  it("keeps a midday-crossing event and its buffers protected", () => {
    const suggestions = generate({
      task: createTask({ estimatedDurationMinutes: 30 }),
      events: [
        createEvent({
          startTime: "11:30",
          endTime: "12:30",
          durationMinutes: 60
        })
      ],
      preferences: {
        ...defaultPreferences,
        planningDayStart: "10:00",
        planningDayEnd: "14:00"
      },
      horizonDays: 1
    });

    assert.ok(
      suggestions.every(
        (suggestion) => suggestion.endTime <= "11:15" || suggestion.startTime >= "12:45"
      )
    );
  });

  it("conservatively blocks the rest of the day after unknown-duration items", () => {
    const eventSuggestions = generate({
      task: createTask({ estimatedDurationMinutes: 30 }),
      events: [createEvent({ startTime: "09:00" })],
      preferences: { ...defaultPreferences, planningDayEnd: "12:00" },
      horizonDays: 1
    });
    const taskSuggestions = generate({
      task: createTask({ estimatedDurationMinutes: 30 }),
      tasks: [
        createTask({
          id: "unknown-task",
          scheduledDate: "2026-08-10",
          scheduledTime: "09:00",
          estimatedDurationMinutes: null
        })
      ],
      preferences: { ...defaultPreferences, planningDayEnd: "12:00" },
      horizonDays: 1
    });

    assert.ok(eventSuggestions.every((suggestion) => suggestion.endTime <= "08:45"));
    assert.ok(taskSuggestions.every((suggestion) => suggestion.endTime <= "09:00"));
  });

  it("returns an empty result for missing duration without mutating inputs", () => {
    const task = createTask({ estimatedDurationMinutes: null });
    const tasks = [createTask({ id: "other-task" })];
    const events = [createEvent()];
    const snapshot = structuredClone({ task, tasks, events });

    assert.deepEqual(generate({ task, tasks, events, horizonDays: 1 }), []);
    assert.deepEqual({ task, tasks, events }, snapshot);
  });

  it("returns a valid empty result when every day exceeds the task-time limit", () => {
    const suggestions = generate({
      task: createTask({ estimatedDurationMinutes: 30 }),
      tasks: [
        createTask({
          id: "full-day-1",
          scheduledDate: "2026-08-10",
          scheduledTime: "08:00",
          estimatedDurationMinutes: 180
        }),
        createTask({
          id: "full-day-2",
          scheduledDate: "2026-08-11",
          scheduledTime: "08:00",
          estimatedDurationMinutes: 180
        })
      ],
      horizonDays: 2
    });

    assert.deepEqual(suggestions, []);
  });
});

describe("scheduling acceptance workflow", () => {
  it("updates one existing task and persists multiple reminder choices", async () => {
    const database = await createSqlJsDatabase();
    await initializeDatabase(database);
    const taskStorage = new SqlTaskStorage(database);
    const synchronizer = new RecordingReminderSynchronizer();
    const taskRepository = new TaskRepository(
      taskStorage,
      () => "existing-task",
      () => now,
      synchronizer
    );
    const eventRepository = new CalendarEventRepository(
      new SqlCalendarEventStorage(database),
      () => "event",
      () => now
    );
    const settingsRepository = new SettingsRepository(
      new SqlSettingsStorage(database),
      () => now
    );
    const task = await taskRepository.createTask({
      title: "Prepare the application",
      scheduledDate: "2026-08-12",
      scheduledTime: "18:00",
      estimatedDurationMinutes: 30,
      deadlineDate: "2026-08-13",
      reminderOffsets: [10]
    });
    await eventRepository.createEvent({
      title: "Appointment",
      date: "2026-08-10",
      startTime: "09:00",
      durationMinutes: 60
    });
    const service = new SchedulingService(
      taskRepository,
      eventRepository,
      settingsRepository,
      () => now
    );
    const search = await service.getSuggestions(task.id);
    const suggestion = search.suggestions[0]!;

    assert.ok(search.suggestions.every((candidate) => candidate.date >= "2026-08-12"));

    const scheduled = await service.acceptSuggestion(task.id, suggestion, {
      reminderOffsets: [1440, 60, 15]
    });

    assert.equal(scheduled.id, task.id);
    assert.equal(scheduled.scheduledDate, suggestion.date);
    assert.equal(scheduled.scheduledTime, suggestion.startTime);
    assert.equal(scheduled.deadlineDate, "2026-08-13");
    assert.deepEqual(scheduled.reminderOffsets, [1440, 60, 15]);
    assert.equal((await taskStorage.getAllTasks()).length, 1);
    assert.equal(synchronizer.tasks.at(-1)?.id, task.id);
    assert.equal(synchronizer.tasks.at(-1)?.scheduledTime, suggestion.startTime);
    assert.deepEqual(synchronizer.tasks.at(-1)?.reminderOffsets, [1440, 60, 15]);

    const reopenedDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(reopenedDatabase);
    const restored = await new SqlTaskStorage(reopenedDatabase).getTaskById(task.id);

    assert.equal(restored?.scheduledDate, suggestion.date);
    assert.equal(restored?.scheduledTime, suggestion.startTime);
    assert.equal(restored?.deadlineDate, "2026-08-13");
    assert.deepEqual(restored?.reminderOffsets, [1440, 60, 15]);
  });

  it("persists a user-selected exact time and multiple reminders", async () => {
    const database = await createSqlJsDatabase();
    await initializeDatabase(database);
    const taskStorage = new SqlTaskStorage(database);
    const synchronizer = new RecordingReminderSynchronizer();
    const taskRepository = new TaskRepository(
      taskStorage,
      () => "manual-task",
      () => now,
      synchronizer
    );
    const task = await taskRepository.createTask({
      title: "Call the clinic",
      scheduledDate: "2026-08-11",
      plannedTimePreference: "morning"
    });
    const service = new SchedulingService(
      taskRepository,
      new CalendarEventRepository(new SqlCalendarEventStorage(database)),
      new SettingsRepository(new SqlSettingsStorage(database)),
      () => now
    );

    const scheduled = await service.scheduleSpecificTime(task.id, {
      scheduledDate: "2026-08-11",
      scheduledTime: "09:30",
      estimatedDurationMinutes: 30,
      reminderOffsets: [1440, 60, 15, 0]
    });

    assert.equal(scheduled.id, task.id);
    assert.equal(scheduled.scheduledDate, "2026-08-11");
    assert.equal(scheduled.scheduledTime, "09:30");
    assert.equal(scheduled.plannedTimePreference, "morning");
    assert.deepEqual(scheduled.reminderOffsets, [1440, 60, 15, 0]);
    assert.deepEqual(synchronizer.tasks.at(-1)?.reminderOffsets, [1440, 60, 15, 0]);

    const reopenedDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(reopenedDatabase);
    const restored = await new SqlTaskStorage(reopenedDatabase).getTaskById(task.id);

    assert.equal(restored?.scheduledTime, "09:30");
    assert.deepEqual(restored?.reminderOffsets, [1440, 60, 15, 0]);
  });

  it("revalidates a suggestion before acceptance", async () => {
    const database = await createSqlJsDatabase();
    await initializeDatabase(database);
    const taskRepository = new TaskRepository(
      new SqlTaskStorage(database),
      () => "stale-task",
      () => now
    );
    const eventRepository = new CalendarEventRepository(
      new SqlCalendarEventStorage(database),
      () => "new-blocker",
      () => now
    );
    const service = new SchedulingService(
      taskRepository,
      eventRepository,
      new SettingsRepository(new SqlSettingsStorage(database), () => now),
      () => now
    );
    const task = await taskRepository.createTask({
      title: "Review notes",
      estimatedDurationMinutes: 30
    });
    const suggestion = (await service.getSuggestions(task.id)).suggestions[0]!;
    await eventRepository.createEvent({
      title: "New appointment",
      date: suggestion.date,
      startTime: suggestion.startTime,
      durationMinutes: suggestion.durationMinutes
    });

    await assert.rejects(
      () => service.acceptSuggestion(task.id, suggestion),
      SchedulingSuggestionUnavailableError
    );
    assert.equal((await taskRepository.getTaskById(task.id)).scheduledDate, null);
  });

  it("reports that a task without an estimate needs a duration", async () => {
    const database = await createSqlJsDatabase();
    await initializeDatabase(database);
    const taskRepository = new TaskRepository(
      new SqlTaskStorage(database),
      () => "duration-task",
      () => now
    );
    const task = await taskRepository.createTask({ title: "Open the mail" });
    const service = new SchedulingService(
      taskRepository,
      new CalendarEventRepository(new SqlCalendarEventStorage(database)),
      new SettingsRepository(new SqlSettingsStorage(database)),
      () => now
    );

    const result = await service.getSuggestions(task.id);

    assert.equal(result.status, "needs_duration");
    assert.equal(result.durationMinutes, null);
    assert.deepEqual(result.suggestions, []);
  });
});

function generate(
  overrides: Partial<SchedulingEngineInput> & Pick<SchedulingEngineInput, "task">
) {
  return generateSchedulingSuggestions({
    task: overrides.task,
    tasks: overrides.tasks ?? [],
    events: overrides.events ?? [],
    preferences: overrides.preferences ?? defaultPreferences,
    startDate: overrides.startDate ?? "2026-08-10",
    horizonDays: overrides.horizonDays ?? 7,
    now: overrides.now ?? now,
    ...(overrides.maximumSuggestions === undefined
      ? {}
      : { maximumSuggestions: overrides.maximumSuggestions })
  });
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task",
    title: "Flexible work",
    description: null,
    importance: "normal",
    status: "not_started",
    parentTaskId: null,
    scheduledDate: null,
    scheduledTime: null,
    plannedTimePreference: null,
    estimatedDurationMinutes: 30,
    deadlineDate: null,
    reminderOffsets: [],
    startedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    deletedAt: null,
    ...overrides
  };
}

function createEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event",
    title: "Fixed appointment",
    kind: "fixed",
    date: "2026-08-10",
    startTime: "09:00",
    endTime: null,
    durationMinutes: null,
    notes: null,
    reminderOffsets: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  };
}

class RecordingReminderSynchronizer implements ReminderSynchronizer {
  readonly tasks: Task[] = [];

  async syncTaskReminder(task: Task) {
    this.tasks.push({ ...task });
  }

  async syncEventReminder() {}
}

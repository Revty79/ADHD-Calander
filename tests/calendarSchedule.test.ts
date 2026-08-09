import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCalendarSchedule,
  getEventDurationMinutes
} from "../src/features/calendar/calendarSchedule";
import { CalendarEvent } from "../src/types/calendarEvent";
import { Task } from "../src/types/task";

const timestamp = "2026-08-06T15:00:00.000Z";

describe("calendar schedule", () => {
  it("keeps fixed events separate from planned and flexible tasks", () => {
    const event = createEvent({ endTime: "10:30" });
    const plannedTask = createTask({
      id: "planned",
      scheduledTime: "11:00",
      estimatedDurationMinutes: 45
    });
    const flexibleTask = createTask({
      id: "flexible",
      scheduledTime: null,
      estimatedDurationMinutes: 20,
      status: "completed"
    });

    const day = buildCalendarSchedule(
      "2026-08-06",
      "2026-08-06",
      [event],
      [plannedTask, flexibleTask]
    ).get("2026-08-06");

    assert.deepEqual(day?.fixedEvents, [event]);
    assert.deepEqual(day?.plannedTasks, [plannedTask]);
    assert.deepEqual(day?.flexibleTasks, [flexibleTask]);
    assert.equal(day?.completedTaskCount, 1);
    assert.equal(day?.scheduledMinutes, 155);
  });

  it("derives event minutes from local wall-clock times", () => {
    assert.equal(getEventDurationMinutes(createEvent({ endTime: "10:30" })), 90);
    assert.equal(
      getEventDurationMinutes(createEvent({ endTime: null, durationMinutes: 35 })),
      35
    );
  });

  it("keeps tasks resolved in Recovery Mode out of active calendar work", () => {
    const delegatedTask = createTask({ id: "delegated", status: "delegated" });
    const removedTask = createTask({ id: "removed", status: "removed" });
    const brokenDownTask = createTask({ id: "broken", status: "broken_down" });

    const day = buildCalendarSchedule(
      "2026-08-06",
      "2026-08-06",
      [],
      [delegatedTask, removedTask, brokenDownTask]
    ).get("2026-08-06");

    assert.equal(day, undefined);
  });
});

function createEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event",
    title: "Fixed appointment",
    kind: "fixed",
    date: "2026-08-06",
    startTime: "09:00",
    endTime: null,
    durationMinutes: null,
    notes: null,
    reminderOffsetMinutes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  };
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task",
    title: "Flexible work",
    description: null,
    importance: "normal",
    status: "not_started",
    parentTaskId: null,
    scheduledDate: "2026-08-06",
    scheduledTime: null,
    estimatedDurationMinutes: null,
    deadlineDate: null,
    reminderOffsetMinutes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    deletedAt: null,
    ...overrides
  };
}

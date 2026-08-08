import { CalendarEvent } from "../types/calendarEvent";
import {
  ReminderNotificationRequest,
  ReminderOffsetMinutes,
  reminderOffsetOptions
} from "../types/reminder";
import { isTaskActive, Task } from "../types/task";
import { normalizeLocalDateInput, normalizeOptionalTime } from "../utils/dates";

export function isReminderOffsetMinutes(value: unknown): value is ReminderOffsetMinutes {
  return (
    typeof value === "number" && reminderOffsetOptions.some((option) => option === value)
  );
}

export function getReminderTriggerDate(
  dateInput: string,
  timeInput: string,
  offsetMinutes: ReminderOffsetMinutes
): Date | null {
  const date = normalizeLocalDateInput(dateInput);
  const time = normalizeOptionalTime(timeInput);

  if (!date || !time) {
    return null;
  }

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const triggerDate = new Date(
    year ?? 0,
    (month ?? 1) - 1,
    day ?? 1,
    hour ?? 0,
    minute ?? 0
  );
  triggerDate.setMinutes(triggerDate.getMinutes() - offsetMinutes);

  return triggerDate;
}

export function buildTaskReminderRequest(task: Task): ReminderNotificationRequest | null {
  if (
    !isTaskActive(task) ||
    task.deletedAt !== null ||
    task.scheduledDate === null ||
    task.scheduledTime === null ||
    task.reminderOffsetMinutes === null
  ) {
    return null;
  }

  const triggerDate = getReminderTriggerDate(
    task.scheduledDate,
    task.scheduledTime,
    task.reminderOffsetMinutes
  );

  if (!triggerDate) {
    return null;
  }

  return {
    identifier: getTaskReminderIdentifier(task.id),
    title: task.title,
    body: `Planned for ${formatLocalTime(task.scheduledDate, task.scheduledTime)}.`,
    triggerDate,
    itemType: "task",
    itemId: task.id
  };
}

export function buildEventReminderRequest(
  event: CalendarEvent
): ReminderNotificationRequest | null {
  if (event.reminderOffsetMinutes === null) {
    return null;
  }

  const triggerDate = getReminderTriggerDate(
    event.date,
    event.startTime,
    event.reminderOffsetMinutes
  );

  if (!triggerDate) {
    return null;
  }

  return {
    identifier: getEventReminderIdentifier(event.id),
    title: event.title,
    body:
      event.reminderOffsetMinutes === 0
        ? "On your calendar now."
        : `On your calendar in ${event.reminderOffsetMinutes} minutes.`,
    triggerDate,
    itemType: "event",
    itemId: event.id
  };
}

export function getTaskReminderIdentifier(taskId: string): string {
  return `adhd-calendar-task-${taskId}`;
}

export function getEventReminderIdentifier(eventId: string): string {
  return `adhd-calendar-event-${eventId}`;
}

export function formatReminderOffset(offset: ReminderOffsetMinutes | null): string {
  if (offset === null) {
    return "No reminder";
  }

  if (offset === 0) {
    return "At the scheduled time";
  }

  if (offset === 60) {
    return "1 hour before";
  }

  return `${offset} minutes before`;
}

function formatLocalTime(date: string, time: string): string {
  const value = getReminderTriggerDate(date, time, 0);

  if (!value) {
    return time;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

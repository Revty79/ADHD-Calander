import { CalendarEvent } from "../types/calendarEvent";
import {
  Reminder,
  ReminderNotificationRequest,
  ReminderOffsetMinutes,
  reminderOffsetOptions
} from "../types/reminder";
import { isTaskActive, Task } from "../types/task";
import { normalizeLocalDateInput, normalizeOptionalTime } from "../utils/dates";
import { getReminderKey } from "./reminders";
export { isReminderOffsetMinutes } from "./reminderOffsets";

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

export function buildTaskReminderRequests(task: Task): ReminderNotificationRequest[] {
  if (!isTaskActive(task) || task.deletedAt !== null) {
    return [];
  }

  return task.reminders.flatMap((reminder) => {
    const triggerDate = getReminderDate(reminder, task.scheduledDate, task.scheduledTime);

    return triggerDate
      ? [
          {
            identifier: getTaskReminderIdentifier(task.id, reminder),
            title: task.title,
            body:
              reminder.kind === "relative" && task.scheduledDate && task.scheduledTime
                ? `Scheduled for ${formatLocalTime(task.scheduledDate, task.scheduledTime)}.`
                : `Reminder set for ${formatReminderDateTime(triggerDate)}.`,
            triggerDate,
            itemType: "task" as const,
            itemId: task.id
          }
        ]
      : [];
  });
}

export function buildEventReminderRequests(
  event: CalendarEvent
): ReminderNotificationRequest[] {
  return event.reminders.flatMap((reminder) => {
    const triggerDate = getReminderDate(reminder, event.date, event.startTime);

    return triggerDate
      ? [
          {
            identifier: getEventReminderIdentifier(event.id, reminder),
            title: event.title,
            body:
              reminder.kind === "relative" && reminder.offsetMinutes === 0
                ? "On your calendar now."
                : reminder.kind === "relative"
                  ? `On your calendar ${formatReminderOffset(reminder.offsetMinutes).toLowerCase()}.`
                  : `Reminder set for ${formatReminderDateTime(triggerDate)}.`,
            triggerDate,
            itemType: "event" as const,
            itemId: event.id
          }
        ]
      : [];
  });
}

export function getTaskReminderIdentifier(
  taskId: string,
  reminder: Reminder | ReminderOffsetMinutes
): string {
  return `adhd-calendar-task-${taskId}-${getIdentifierSuffix(reminder)}`;
}

export function getEventReminderIdentifier(
  eventId: string,
  reminder: Reminder | ReminderOffsetMinutes
): string {
  return `adhd-calendar-event-${eventId}-${getIdentifierSuffix(reminder)}`;
}

export function getAllTaskReminderIdentifiers(
  taskId: string,
  reminders: readonly Reminder[] = []
): string[] {
  return [
    `adhd-calendar-task-${taskId}`,
    ...reminderOffsetOptions.map((offset) => getTaskReminderIdentifier(taskId, offset)),
    ...reminders.map((reminder) => getTaskReminderIdentifier(taskId, reminder))
  ];
}

export function getAllEventReminderIdentifiers(
  eventId: string,
  reminders: readonly Reminder[] = []
): string[] {
  return [
    `adhd-calendar-event-${eventId}`,
    ...reminderOffsetOptions.map((offset) => getEventReminderIdentifier(eventId, offset)),
    ...reminders.map((reminder) => getEventReminderIdentifier(eventId, reminder))
  ];
}

export function formatReminderOffset(offset: ReminderOffsetMinutes | null): string {
  if (offset === null) {
    return "No reminder";
  }

  if (offset === 0) {
    return "At start";
  }

  if (offset === 60) {
    return "1 hour before";
  }

  if (offset === 1440) {
    return "1 day before";
  }

  return `${offset} minutes before`;
}

export function formatReminderOffsets(offsets: ReminderOffsetMinutes[]): string {
  if (offsets.length === 0) {
    return "No reminders";
  }

  return offsets.map(formatReminderOffset).join(", ");
}

export function formatReminder(reminder: Reminder): string {
  if (reminder.kind === "relative") {
    return formatReminderOffset(reminder.offsetMinutes);
  }

  const triggerDate = getReminderTriggerDate(reminder.date, reminder.time, 0);

  return triggerDate ? formatReminderDateTime(triggerDate) : "Custom reminder";
}

export function formatReminders(reminders: readonly Reminder[]): string {
  return reminders.length === 0
    ? "No reminders"
    : reminders.map(formatReminder).join(", ");
}

export function getReminderDate(
  reminder: Reminder,
  anchorDate: string | null,
  anchorTime: string | null
): Date | null {
  return reminder.kind === "absolute"
    ? getReminderTriggerDate(reminder.date, reminder.time, 0)
    : anchorDate && anchorTime
      ? getReminderTriggerDate(anchorDate, anchorTime, reminder.offsetMinutes)
      : null;
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

function formatReminderDateTime(triggerDate: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(triggerDate);
}

function getIdentifierSuffix(reminder: Reminder | ReminderOffsetMinutes): string {
  if (typeof reminder === "number") {
    return String(reminder);
  }

  return reminder.kind === "relative"
    ? String(reminder.offsetMinutes)
    : getReminderKey(reminder);
}

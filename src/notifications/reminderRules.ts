import { CalendarEvent } from "../types/calendarEvent";
import {
  ReminderNotificationRequest,
  ReminderOffsetMinutes,
  reminderOffsetOptions
} from "../types/reminder";
import { isTaskActive, Task } from "../types/task";
import { normalizeLocalDateInput, normalizeOptionalTime } from "../utils/dates";
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
  if (
    !isTaskActive(task) ||
    task.deletedAt !== null ||
    task.scheduledDate === null ||
    task.scheduledTime === null
  ) {
    return [];
  }

  return task.reminderOffsets.flatMap((offset) => {
    const triggerDate = getReminderTriggerDate(
      task.scheduledDate!,
      task.scheduledTime!,
      offset
    );

    return triggerDate
      ? [
          {
            identifier: getTaskReminderIdentifier(task.id, offset),
            title: task.title,
            body: `Planned for ${formatLocalTime(task.scheduledDate!, task.scheduledTime!)}.`,
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
  return event.reminderOffsets.flatMap((offset) => {
    const triggerDate = getReminderTriggerDate(event.date, event.startTime, offset);

    return triggerDate
      ? [
          {
            identifier: getEventReminderIdentifier(event.id, offset),
            title: event.title,
            body:
              offset === 0
                ? "On your calendar now."
                : `On your calendar ${formatReminderOffset(offset).toLowerCase()}.`,
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
  offset: ReminderOffsetMinutes
): string {
  return `adhd-calendar-task-${taskId}-${offset}`;
}

export function getEventReminderIdentifier(
  eventId: string,
  offset: ReminderOffsetMinutes
): string {
  return `adhd-calendar-event-${eventId}-${offset}`;
}

export function getAllTaskReminderIdentifiers(taskId: string): string[] {
  return [
    `adhd-calendar-task-${taskId}`,
    ...reminderOffsetOptions.map((offset) => getTaskReminderIdentifier(taskId, offset))
  ];
}

export function getAllEventReminderIdentifiers(eventId: string): string[] {
  return [
    `adhd-calendar-event-${eventId}`,
    ...reminderOffsetOptions.map((offset) => getEventReminderIdentifier(eventId, offset))
  ];
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

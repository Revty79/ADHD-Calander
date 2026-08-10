import {
  Reminder,
  ReminderOffsetMinutes,
  ReminderPermissionStatus
} from "../../types/reminder";
import { getReminderKey, normalizeReminders } from "../../notifications/reminders";

export function toggleRelativeReminder(
  reminders: readonly Reminder[],
  offsetMinutes: ReminderOffsetMinutes
): Reminder[] {
  const key = getReminderKey({ kind: "relative", offsetMinutes });
  const exists = reminders.some((reminder) => getReminderKey(reminder) === key);

  return exists
    ? reminders.filter((reminder) => getReminderKey(reminder) !== key)
    : normalizeReminders([...reminders, { kind: "relative", offsetMinutes }]);
}

export function upsertAbsoluteReminder(
  reminders: readonly Reminder[],
  previousKey: string | null,
  date: string,
  time: string
): Reminder[] {
  const retained = previousKey
    ? reminders.filter((reminder) => getReminderKey(reminder) !== previousKey)
    : reminders;

  return normalizeReminders([...retained, { kind: "absolute", date, time }]);
}

export function removeReminder(
  reminders: readonly Reminder[],
  reminderToRemove: Reminder
): Reminder[] {
  const key = getReminderKey(reminderToRemove);

  return reminders.filter((reminder) => getReminderKey(reminder) !== key);
}

export function getReminderDeliveryMessage(
  permissionStatus: ReminderPermissionStatus | undefined,
  remindersEnabled: boolean | undefined
): string {
  if (permissionStatus === "unsupported") {
    return "Notification delivery is unavailable on this platform.";
  }

  if (permissionStatus === "denied") {
    return "Notification permission is off. Choices stay saved; Settings explains how to enable delivery.";
  }

  if (remindersEnabled !== true) {
    return "Delivery is off. Choices stay saved; turn on reminders in Settings when you want notifications.";
  }

  return "Reminder delivery is on. Only future reminder times are scheduled.";
}

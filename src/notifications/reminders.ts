import {
  maxRemindersPerItem,
  Reminder,
  ReminderInput,
  ReminderOffsetMinutes
} from "../types/reminder";
import { normalizeLocalDateInput, normalizeOptionalTime } from "../utils/dates";
import {
  isReminderOffsetList,
  isReminderOffsetMinutes,
  normalizeReminderOffsets,
  parseStoredReminderOffsets
} from "./reminderOffsets";

export function normalizeReminders(
  values: readonly ReminderInput[] | readonly Reminder[]
): Reminder[] {
  if (!Array.isArray(values) || values.length > maxRemindersPerItem) {
    throw new Error(`Choose up to ${maxRemindersPerItem} reminders.`);
  }

  const reminders = values.map(normalizeReminder);
  const keys = reminders.map(getReminderKey);

  if (new Set(keys).size !== keys.length) {
    throw new Error("Choose different reminder times.");
  }

  return reminders.sort(compareReminders);
}

export function normalizeStoredReminders(
  value: unknown,
  legacyOffsets: unknown
): Reminder[] {
  if (value === undefined || value === null) {
    if (!isReminderOffsetList(legacyOffsets)) {
      throw new Error("Stored reminder choices have an invalid shape.");
    }

    return remindersFromOffsets(legacyOffsets);
  }

  if (!Array.isArray(value)) {
    throw new Error("Stored reminders have an invalid shape.");
  }

  return normalizeReminders(value as ReminderInput[]);
}

export function parseStoredReminders(
  value: string | null,
  legacyOffsets: string
): Reminder[] {
  if (value === null) {
    return remindersFromOffsets(parseStoredReminderOffsets(legacyOffsets));
  }

  const parsedValue: unknown = JSON.parse(value);

  return normalizeStoredReminders(parsedValue, []);
}

export function remindersFromOffsets(
  offsets: readonly ReminderOffsetMinutes[]
): Reminder[] {
  return normalizeReminderOffsets(offsets).map((offsetMinutes) => ({
    kind: "relative",
    offsetMinutes
  }));
}

export function getRelativeReminderOffsets(
  reminders: readonly Reminder[]
): ReminderOffsetMinutes[] {
  return normalizeReminderOffsets(
    reminders.flatMap((reminder) =>
      reminder.kind === "relative" ? [reminder.offsetMinutes] : []
    )
  );
}

export function getReminderKey(reminder: Reminder): string {
  return reminder.kind === "relative"
    ? `relative-${reminder.offsetMinutes}`
    : `absolute-${reminder.date}-${reminder.time.replace(":", "")}`;
}

function normalizeReminder(value: ReminderInput | Reminder): Reminder {
  if (!value || typeof value !== "object") {
    throw new Error("Choose a valid reminder.");
  }

  if (value.kind === "relative") {
    if (!isReminderOffsetMinutes(value.offsetMinutes)) {
      throw new Error("Choose an available relative reminder time.");
    }

    return { kind: "relative", offsetMinutes: value.offsetMinutes };
  }

  if (value.kind === "absolute") {
    const date = normalizeLocalDateInput(value.date);
    const time = normalizeOptionalTime(value.time);

    if (!date || !time) {
      throw new Error("Choose a valid reminder date and time.");
    }

    return { kind: "absolute", date, time };
  }

  throw new Error("Choose a valid reminder type.");
}

function compareReminders(first: Reminder, second: Reminder): number {
  if (first.kind !== second.kind) {
    return first.kind === "relative" ? -1 : 1;
  }

  if (first.kind === "relative" && second.kind === "relative") {
    return second.offsetMinutes - first.offsetMinutes;
  }

  if (first.kind === "absolute" && second.kind === "absolute") {
    return first.date.localeCompare(second.date) || first.time.localeCompare(second.time);
  }

  return 0;
}

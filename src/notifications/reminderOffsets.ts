import {
  maxRemindersPerItem,
  ReminderOffsetMinutes,
  reminderOffsetOptions
} from "../types/reminder";

export function isReminderOffsetMinutes(value: unknown): value is ReminderOffsetMinutes {
  return (
    typeof value === "number" && reminderOffsetOptions.some((option) => option === value)
  );
}

export function isReminderOffsetList(
  value: unknown,
  maximum = maxRemindersPerItem
): value is ReminderOffsetMinutes[] {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every(isReminderOffsetMinutes) &&
    new Set(value).size === value.length
  );
}

export function normalizeReminderOffsets(
  values: readonly ReminderOffsetMinutes[]
): ReminderOffsetMinutes[] {
  return [...values].sort((first, second) => second - first);
}

export function parseStoredReminderOffsets(value: string): ReminderOffsetMinutes[] {
  const parsedValue: unknown = JSON.parse(value);

  if (!isReminderOffsetList(parsedValue)) {
    throw new Error("Stored reminder choices have an invalid shape.");
  }

  return normalizeReminderOffsets(parsedValue);
}

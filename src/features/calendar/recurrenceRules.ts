import {
  CalendarRecurrenceRule,
  CalendarWeekday,
  RecurrenceEnd
} from "../../types/calendarEvent";
import { LocalDateString } from "../../types/dateTime";
import { normalizeLocalDateInput } from "../../utils/dates";
import { getOrdinalWeekday, getWeekday } from "./recurrence";

export const recurrencePresets = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "custom"
] as const;

export type RecurrencePreset = (typeof recurrencePresets)[number];

export const weekdayOptions: readonly { value: CalendarWeekday; label: string }[] = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" }
];

export function buildPresetRecurrence(
  preset: Exclude<RecurrencePreset, "none" | "custom">,
  anchorDate: LocalDateString
): CalendarRecurrenceRule {
  const end: RecurrenceEnd = { kind: "never" };

  if (preset === "daily") {
    return { frequency: "daily", interval: 1, end };
  }

  if (preset === "weekly") {
    return { frequency: "weekly", interval: 1, weekdays: [getWeekday(anchorDate)], end };
  }

  if (preset === "monthly") {
    return {
      frequency: "monthly",
      interval: 1,
      monthlyPattern: { kind: "same_date" },
      end
    };
  }

  return { frequency: "yearly", interval: 1, end };
}

export function getRecurrencePreset(
  recurrence: CalendarRecurrenceRule | null,
  anchorDate: LocalDateString
): RecurrencePreset {
  if (!recurrence) {
    return "none";
  }

  if (recurrence.interval !== 1 || recurrence.end.kind !== "never") {
    return "custom";
  }

  if (recurrence.frequency === "daily" || recurrence.frequency === "yearly") {
    return recurrence.frequency;
  }

  if (
    recurrence.frequency === "weekly" &&
    recurrence.weekdays.length === 1 &&
    recurrence.weekdays[0] === getWeekday(anchorDate)
  ) {
    return "weekly";
  }

  if (
    recurrence.frequency === "monthly" &&
    recurrence.monthlyPattern.kind === "same_date"
  ) {
    return "monthly";
  }

  return "custom";
}

export function normalizeRecurrenceRule(
  value: unknown,
  anchorDate: LocalDateString
): CalendarRecurrenceRule | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    throw new Error("Choose a valid repeat pattern.");
  }

  const frequency = value.frequency;
  const interval = value.interval;
  const end = normalizeRecurrenceEnd(value.end, anchorDate);

  if (
    !["daily", "weekly", "monthly", "yearly"].includes(String(frequency)) ||
    !Number.isInteger(interval) ||
    Number(interval) < 1 ||
    Number(interval) > 999
  ) {
    throw new Error("Repeat interval must be a whole number from 1 to 999.");
  }

  if (frequency === "daily") {
    return { frequency, interval: Number(interval), end };
  }

  if (frequency === "weekly") {
    if (!Array.isArray(value.weekdays)) {
      throw new Error("Choose at least one weekday.");
    }

    const weekdays = [...new Set(value.weekdays)].sort(
      (first, second) => Number(first) - Number(second)
    );

    if (
      weekdays.length === 0 ||
      weekdays.some((weekday) => !isCalendarWeekday(weekday))
    ) {
      throw new Error("Choose at least one valid weekday.");
    }

    if (!weekdays.includes(getWeekday(anchorDate))) {
      throw new Error("The starting date must be one of the selected weekdays.");
    }

    return {
      frequency,
      interval: Number(interval),
      weekdays: weekdays as CalendarWeekday[],
      end
    };
  }

  if (frequency === "monthly") {
    const pattern = value.monthlyPattern;

    if (!isRecord(pattern)) {
      throw new Error("Choose a valid monthly pattern.");
    }

    if (pattern.kind === "same_date") {
      return {
        frequency,
        interval: Number(interval),
        monthlyPattern: { kind: "same_date" },
        end
      };
    }

    if (
      pattern.kind !== "ordinal_weekday" ||
      ![1, 2, 3, 4, -1].includes(Number(pattern.ordinal)) ||
      !isCalendarWeekday(pattern.weekday)
    ) {
      throw new Error("Choose a valid monthly weekday pattern.");
    }

    const anchorPattern = getOrdinalWeekday(anchorDate);

    if (
      anchorPattern.ordinal !== pattern.ordinal ||
      anchorPattern.weekday !== pattern.weekday
    ) {
      throw new Error("The starting date must match the selected monthly pattern.");
    }

    return {
      frequency,
      interval: Number(interval),
      monthlyPattern: {
        kind: "ordinal_weekday",
        ordinal: pattern.ordinal as 1 | 2 | 3 | 4 | -1,
        weekday: pattern.weekday
      },
      end
    };
  }

  return { frequency: "yearly", interval: Number(interval), end };
}

export function formatRecurrence(recurrence: CalendarRecurrenceRule | null): string {
  if (!recurrence) {
    return "Doesn't repeat";
  }

  const interval = recurrence.interval;
  let frequencyLabel: string;

  if (recurrence.frequency === "daily") {
    frequencyLabel = interval === 1 ? "Daily" : `Every ${interval} days`;
  } else if (recurrence.frequency === "weekly") {
    const days = recurrence.weekdays.map(getWeekdayLabel).join(", ");
    frequencyLabel =
      interval === 1 ? `Weekly on ${days}` : `Every ${interval} weeks on ${days}`;
  } else if (recurrence.frequency === "monthly") {
    const pattern = recurrence.monthlyPattern;
    const patternLabel =
      pattern.kind === "same_date"
        ? "the same date"
        : `${getOrdinalLabel(pattern.ordinal)} ${getWeekdayLabel(pattern.weekday)}`;
    frequencyLabel =
      interval === 1
        ? `Monthly on ${patternLabel}`
        : `Every ${interval} months on ${patternLabel}`;
  } else {
    frequencyLabel = interval === 1 ? "Yearly" : `Every ${interval} years`;
  }

  if (recurrence.end.kind === "on_date") {
    return `${frequencyLabel}, through ${recurrence.end.date}`;
  }

  if (recurrence.end.kind === "after_count") {
    return `${frequencyLabel}, ${recurrence.end.count} occurrences`;
  }

  return frequencyLabel;
}

export function getWeekdayLabel(weekday: CalendarWeekday): string {
  return weekdayOptions.find((option) => option.value === weekday)?.label ?? "Day";
}

export function getOrdinalLabel(ordinal: 1 | 2 | 3 | 4 | -1): string {
  return (
    {
      1: "first",
      2: "second",
      3: "third",
      4: "fourth",
      [-1]: "last"
    } as const
  )[ordinal];
}

function normalizeRecurrenceEnd(
  value: unknown,
  anchorDate: LocalDateString
): RecurrenceEnd {
  if (!isRecord(value) || value.kind === "never") {
    return { kind: "never" };
  }

  if (value.kind === "on_date") {
    const date =
      typeof value.date === "string" ? normalizeLocalDateInput(value.date) : null;

    if (!date || date < anchorDate) {
      throw new Error("The repeat end date must be on or after the starting date.");
    }

    return { kind: "on_date", date };
  }

  if (
    value.kind === "after_count" &&
    Number.isInteger(value.count) &&
    Number(value.count) >= 1 &&
    Number(value.count) <= 9999
  ) {
    return { kind: "after_count", count: Number(value.count) };
  }

  throw new Error("Choose a valid repeat end condition.");
}

function isCalendarWeekday(value: unknown): value is CalendarWeekday {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

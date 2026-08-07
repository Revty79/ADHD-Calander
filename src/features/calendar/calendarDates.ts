import { LocalDateString } from "../../types/dateTime";
import { getLocalDateString, normalizeLocalDateInput } from "../../utils/dates";

export const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type MonthGridDay = {
  date: LocalDateString;
  dayNumber: number;
  isCurrentMonth: boolean;
};

export function addLocalDays(date: LocalDateString, amount: number): LocalDateString {
  const value = parseLocalDate(date);
  value.setDate(value.getDate() + amount);

  return getLocalDateString(value);
}

export function addLocalMonths(date: LocalDateString, amount: number): LocalDateString {
  const value = parseLocalDate(date);
  value.setDate(1);
  value.setMonth(value.getMonth() + amount);

  return getLocalDateString(value);
}

export function getStartOfWeek(date: LocalDateString): LocalDateString {
  const value = parseLocalDate(date);

  return addLocalDays(date, -value.getDay());
}

export function getWeekDates(date: LocalDateString): LocalDateString[] {
  const start = getStartOfWeek(date);

  return Array.from({ length: 7 }, (_, index) => addLocalDays(start, index));
}

export function getMonthGrid(date: LocalDateString): MonthGridDay[] {
  const selected = parseLocalDate(date);
  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const gridStart = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    1 - monthStart.getDay()
  );

  return Array.from({ length: 42 }, (_, index) => {
    const gridDate = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    );

    return {
      date: getLocalDateString(gridDate),
      dayNumber: gridDate.getDate(),
      isCurrentMonth: gridDate.getMonth() === selected.getMonth()
    };
  });
}

export function getCalendarRange(
  view: "month" | "week" | "day",
  date: LocalDateString
): { startDate: LocalDateString; endDate: LocalDateString } {
  if (view === "month") {
    const days = getMonthGrid(date);

    return {
      startDate: days[0]?.date ?? date,
      endDate: days.at(-1)?.date ?? date
    };
  }

  if (view === "week") {
    const dates = getWeekDates(date);

    return {
      startDate: dates[0] ?? date,
      endDate: dates.at(-1) ?? date
    };
  }

  return { startDate: date, endDate: date };
}

export function formatMonthHeading(date: LocalDateString): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric"
  }).format(parseLocalDate(date));
}

export function formatWeekHeading(date: LocalDateString): string {
  const dates = getWeekDates(date);
  const start = parseLocalDate(dates[0] ?? date);
  const end = parseLocalDate(dates.at(-1) ?? date);
  const startLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(start);
  const endLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(end);

  return `${startLabel} - ${endLabel}`;
}

export function formatDayHeading(date: LocalDateString): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(parseLocalDate(date));
}

export function formatCompactDay(date: LocalDateString): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(parseLocalDate(date));
}

function parseLocalDate(date: LocalDateString): Date {
  const normalizedDate = normalizeLocalDateInput(date);

  if (!normalizedDate) {
    throw new Error(`Invalid local date: ${date}`);
  }

  const [year, month, day] = normalizedDate.split("-").map(Number);

  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12);
}

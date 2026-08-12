import {
  CalendarEvent,
  CalendarEventException,
  CalendarEventOccurrence,
  CalendarRecurrenceRule,
  CalendarWeekday,
  RecurrenceEnd
} from "../../types/calendarEvent";
import { LocalDateString } from "../../types/dateTime";
import { getRelativeReminderOffsets } from "../../notifications/reminders";
import { normalizeLocalDateInput } from "../../utils/dates";

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function expandCalendarEventsForRange(
  events: readonly CalendarEvent[],
  exceptions: readonly CalendarEventException[],
  startDate: LocalDateString,
  endDate: LocalDateString
): CalendarEventOccurrence[] {
  const exceptionsBySeries = new Map<string, CalendarEventException[]>();

  for (const exception of exceptions) {
    const seriesExceptions = exceptionsBySeries.get(exception.seriesId) ?? [];
    seriesExceptions.push(exception);
    exceptionsBySeries.set(exception.seriesId, seriesExceptions);
  }

  return events
    .flatMap((event) =>
      expandCalendarEventForRange(
        event,
        exceptionsBySeries.get(event.id) ?? [],
        startDate,
        endDate
      )
    )
    .sort(compareCalendarEventOccurrences);
}

export function expandCalendarEventForRange(
  event: CalendarEvent,
  exceptions: readonly CalendarEventException[],
  startDate: LocalDateString,
  endDate: LocalDateString
): CalendarEventOccurrence[] {
  if (!event.recurrence) {
    return event.date >= startDate && event.date <= endDate
      ? [materializeCalendarEventOccurrence(event, event.date, null)!]
      : [];
  }

  const exceptionsByOriginalDate = new Map(
    exceptions.map((exception) => [exception.originalDate, exception])
  );
  const datesToExpand = new Set<LocalDateString>();

  for (const date of iterateLocalDates(startDate, endDate)) {
    if (isRecurrenceDate(event.date, event.recurrence, date)) {
      datesToExpand.add(date);
    }
  }

  for (const exception of exceptions) {
    const movedDate = exception.overrides.date;

    if (
      movedDate &&
      movedDate >= startDate &&
      movedDate <= endDate &&
      isRecurrenceDate(event.date, event.recurrence, exception.originalDate)
    ) {
      datesToExpand.add(exception.originalDate);
    }
  }

  return [...datesToExpand]
    .flatMap((originalDate) => {
      const occurrence = materializeCalendarEventOccurrence(
        event,
        originalDate,
        exceptionsByOriginalDate.get(originalDate) ?? null
      );

      return occurrence && occurrence.date >= startDate && occurrence.date <= endDate
        ? [occurrence]
        : [];
    })
    .sort(compareCalendarEventOccurrences);
}

export function isRecurrenceDate(
  anchorDate: LocalDateString,
  recurrence: CalendarRecurrenceRule,
  candidateDate: LocalDateString
): boolean {
  if (
    candidateDate < anchorDate ||
    !matchesFrequency(anchorDate, recurrence, candidateDate)
  ) {
    return false;
  }

  const occurrenceIndex = getOccurrenceIndex(anchorDate, recurrence, candidateDate);

  if (occurrenceIndex === null) {
    return false;
  }

  if (recurrence.end.kind === "on_date" && candidateDate > recurrence.end.date) {
    return false;
  }

  return recurrence.end.kind !== "after_count" || occurrenceIndex <= recurrence.end.count;
}

export function getRecurrenceEndBefore(originalDate: LocalDateString): RecurrenceEnd {
  return { kind: "on_date", date: addLocalDays(originalDate, -1) };
}

export function hasOccurrenceBefore(
  anchorDate: LocalDateString,
  _recurrence: CalendarRecurrenceRule,
  originalDate: LocalDateString
): boolean {
  return originalDate > anchorDate;
}

export function compareCalendarEventOccurrences(
  first: CalendarEventOccurrence,
  second: CalendarEventOccurrence
): number {
  return (
    first.date.localeCompare(second.date) ||
    first.startTime.localeCompare(second.startTime) ||
    first.createdAt.localeCompare(second.createdAt) ||
    first.id.localeCompare(second.id)
  );
}

export function getWeekday(date: LocalDateString): CalendarWeekday {
  const { year, month, day } = parseLocalDate(date);
  return new Date(year, month - 1, day, 12).getDay() as CalendarWeekday;
}

export function getOrdinalWeekday(date: LocalDateString): {
  ordinal: 1 | 2 | 3 | 4 | -1;
  weekday: CalendarWeekday;
} {
  const { year, month, day } = parseLocalDate(date);
  const weekday = getWeekday(date);
  const ordinal = Math.ceil(day / 7) as 1 | 2 | 3 | 4 | 5;
  const daysInMonth = new Date(year, month, 0, 12).getDate();

  return {
    ordinal: day + 7 > daysInMonth ? -1 : (Math.min(ordinal, 4) as 1 | 2 | 3 | 4),
    weekday
  };
}

export function addLocalDays(date: LocalDateString, amount: number): LocalDateString {
  const { year, month, day } = parseLocalDate(date);
  const next = new Date(year, month - 1, day + amount, 12);

  return formatLocalDate(next.getFullYear(), next.getMonth() + 1, next.getDate());
}

export function materializeCalendarEventOccurrence(
  event: CalendarEvent,
  originalDate: LocalDateString,
  exception: CalendarEventException | null
): CalendarEventOccurrence | null {
  if (exception?.status === "cancelled") {
    return null;
  }

  const overrides = exception?.overrides ?? {};
  const reminders = overrides.reminders ?? event.reminders;

  return {
    id: event.recurrence ? getCalendarOccurrenceId(event.id, originalDate) : event.id,
    seriesId: event.id,
    originalDate,
    isRecurring: event.recurrence !== null,
    title: overrides.title ?? event.title,
    kind: event.kind,
    date: overrides.date ?? originalDate,
    startTime: overrides.startTime ?? event.startTime,
    endTime: overrides.endTime === undefined ? event.endTime : overrides.endTime,
    durationMinutes:
      overrides.durationMinutes === undefined
        ? event.durationMinutes
        : overrides.durationMinutes,
    notes: overrides.notes === undefined ? event.notes : overrides.notes,
    color: overrides.color ?? event.color,
    reminders,
    reminderOffsets: getRelativeReminderOffsets(reminders),
    recurrence: event.recurrence,
    createdAt: event.createdAt,
    updatedAt: exception?.updatedAt ?? event.updatedAt
  };
}

export function getCalendarOccurrenceId(
  seriesId: string,
  originalDate: LocalDateString
): string {
  return `${seriesId}::${originalDate}`;
}

function matchesFrequency(
  anchorDate: LocalDateString,
  recurrence: CalendarRecurrenceRule,
  candidateDate: LocalDateString
): boolean {
  const anchor = parseLocalDate(anchorDate);
  const candidate = parseLocalDate(candidateDate);

  if (recurrence.frequency === "daily") {
    return differenceInDays(anchorDate, candidateDate) % recurrence.interval === 0;
  }

  if (recurrence.frequency === "weekly") {
    const weekDifference = Math.floor(
      differenceInDays(startOfWeek(anchorDate), startOfWeek(candidateDate)) / 7
    );
    return (
      weekDifference % recurrence.interval === 0 &&
      recurrence.weekdays.includes(getWeekday(candidateDate))
    );
  }

  if (recurrence.frequency === "monthly") {
    const monthDifference =
      (candidate.year - anchor.year) * 12 + candidate.month - anchor.month;

    if (monthDifference % recurrence.interval !== 0) {
      return false;
    }

    if (recurrence.monthlyPattern.kind === "same_date") {
      return candidate.day === anchor.day;
    }

    return isOrdinalWeekdayDate(
      candidateDate,
      recurrence.monthlyPattern.ordinal,
      recurrence.monthlyPattern.weekday
    );
  }

  const yearDifference = candidate.year - anchor.year;

  return (
    yearDifference % recurrence.interval === 0 &&
    candidate.month === anchor.month &&
    candidate.day === anchor.day
  );
}

function getOccurrenceIndex(
  anchorDate: LocalDateString,
  recurrence: CalendarRecurrenceRule,
  candidateDate: LocalDateString
): number | null {
  if (!matchesFrequency(anchorDate, recurrence, candidateDate)) {
    return null;
  }

  if (recurrence.frequency === "daily") {
    return differenceInDays(anchorDate, candidateDate) / recurrence.interval + 1;
  }

  if (recurrence.frequency === "weekly") {
    const selectedWeekdays = [...recurrence.weekdays].sort(
      (first, second) => first - second
    );
    const anchorWeekday = getWeekday(anchorDate);
    const candidateWeekday = getWeekday(candidateDate);
    const activeWeekIndex =
      Math.floor(
        differenceInDays(startOfWeek(anchorDate), startOfWeek(candidateDate)) / 7
      ) / recurrence.interval;
    const firstWeekCount = selectedWeekdays.filter(
      (weekday) => weekday >= anchorWeekday
    ).length;

    if (activeWeekIndex === 0) {
      return selectedWeekdays.filter(
        (weekday) => weekday >= anchorWeekday && weekday <= candidateWeekday
      ).length;
    }

    const candidateWeekCount = selectedWeekdays.filter(
      (weekday) => weekday <= candidateWeekday
    ).length;

    return (
      firstWeekCount +
      Math.max(0, activeWeekIndex - 1) * selectedWeekdays.length +
      candidateWeekCount
    );
  }

  if (recurrence.frequency === "monthly") {
    const anchor = parseLocalDate(anchorDate);
    const candidate = parseLocalDate(candidateDate);
    const monthDifference =
      (candidate.year - anchor.year) * 12 + candidate.month - anchor.month;
    let occurrenceCount = 0;

    for (
      let activeMonthDifference = 0;
      activeMonthDifference <= monthDifference;
      activeMonthDifference += recurrence.interval
    ) {
      const monthIndex = anchor.month - 1 + activeMonthDifference;
      const year = anchor.year + Math.floor(monthIndex / 12);
      const month = (((monthIndex % 12) + 12) % 12) + 1;

      if (
        recurrence.monthlyPattern.kind === "ordinal_weekday" ||
        anchor.day <= new Date(year, month, 0, 12).getDate()
      ) {
        occurrenceCount += 1;
      }
    }

    return occurrenceCount;
  }

  const anchor = parseLocalDate(anchorDate);
  const candidate = parseLocalDate(candidateDate);
  let occurrenceCount = 0;

  for (let year = anchor.year; year <= candidate.year; year += recurrence.interval) {
    if (anchor.day <= new Date(year, anchor.month, 0, 12).getDate()) {
      occurrenceCount += 1;
    }
  }

  return occurrenceCount;
}

function isOrdinalWeekdayDate(
  date: LocalDateString,
  ordinal: 1 | 2 | 3 | 4 | -1,
  weekday: CalendarWeekday
): boolean {
  if (getWeekday(date) !== weekday) {
    return false;
  }

  const { year, month, day } = parseLocalDate(date);

  if (ordinal === -1) {
    return day + 7 > new Date(year, month, 0, 12).getDate();
  }

  return Math.ceil(day / 7) === ordinal;
}

function startOfWeek(date: LocalDateString): LocalDateString {
  return addLocalDays(date, -getWeekday(date));
}

function differenceInDays(startDate: LocalDateString, endDate: LocalDateString): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  return Math.round(
    (Date.UTC(end.year, end.month - 1, end.day) -
      Date.UTC(start.year, start.month - 1, start.day)) /
      millisecondsPerDay
  );
}

function* iterateLocalDates(
  startDate: LocalDateString,
  endDate: LocalDateString
): Generator<LocalDateString> {
  let date = startDate;

  while (date <= endDate) {
    yield date;
    date = addLocalDays(date, 1);
  }
}

function parseLocalDate(date: LocalDateString): {
  year: number;
  month: number;
  day: number;
} {
  const normalized = normalizeLocalDateInput(date);

  if (!normalized) {
    throw new Error(`Invalid local date: ${date}`);
  }

  const [year, month, day] = normalized.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

function formatLocalDate(year: number, month: number, day: number): LocalDateString {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` as LocalDateString;
}

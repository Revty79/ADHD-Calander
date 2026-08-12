import {
  CalendarEvent,
  CalendarEventEditScope,
  CalendarEventException,
  CalendarEventOccurrence,
  CreateCalendarEventInput,
  UpdateCalendarEventInput
} from "../../types/calendarEvent";
import { isItemColor } from "../../types/itemColor";
import {
  getReminderDate,
  getReminderTriggerDate
} from "../../notifications/reminderRules";
import {
  isReminderOffsetList,
  normalizeReminderOffsets
} from "../../notifications/reminderOffsets";
import {
  getRelativeReminderOffsets,
  getReminderKey,
  normalizeReminders,
  remindersFromOffsets
} from "../../notifications/reminders";
import {
  noOpReminderSynchronizer,
  ReminderSynchronizer
} from "../../notifications/reminderSynchronizer";
import {
  addLocalDays,
  compareCalendarEventOccurrences,
  expandCalendarEventsForRange,
  getCalendarOccurrenceId,
  getRecurrenceEndBefore,
  hasOccurrenceBefore,
  isRecurrenceDate,
  materializeCalendarEventOccurrence
} from "../../features/calendar/recurrence";
import { normalizeRecurrenceRule } from "../../features/calendar/recurrenceRules";
import { normalizeLocalDateInput, normalizeOptionalTime } from "../../utils/dates";
import { createCalendarEventId } from "../../utils/ids";
import { CalendarEventStorage } from "../calendarEventStorage";
import {
  CalendarEventNotFoundError,
  CalendarEventPersistenceError,
  CalendarEventValidationError
} from "./calendarEventErrors";

type Clock = () => Date;
type IdGenerator = () => string;

type NormalizedCalendarEventInput = Pick<
  CalendarEvent,
  | "title"
  | "date"
  | "startTime"
  | "endTime"
  | "durationMinutes"
  | "notes"
  | "color"
  | "reminders"
  | "reminderOffsets"
  | "recurrence"
>;

export class CalendarEventRepository {
  constructor(
    private readonly storage: CalendarEventStorage,
    private readonly idGenerator: IdGenerator = createCalendarEventId,
    private readonly clock: Clock = () => new Date(),
    private readonly reminderSynchronizer: ReminderSynchronizer = noOpReminderSynchronizer
  ) {}

  async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    const normalizedInput = normalizeCalendarEventInput(input);
    const now = this.clock();
    validateNewReminders(normalizedInput, now);
    const timestamp = now.toISOString();
    const event: CalendarEvent = {
      id: this.idGenerator(),
      kind: "fixed",
      ...normalizedInput,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    try {
      await this.storage.insertEvent(event);
    } catch (error) {
      throw new CalendarEventPersistenceError("Unable to save the event.", error);
    }

    await this.reminderSynchronizer.syncEventReminder(event, undefined, [], []);
    return event;
  }

  async getEventSeries(id: string): Promise<CalendarEvent> {
    try {
      const event = await this.storage.getEventById(id);

      if (!event) {
        throw new CalendarEventNotFoundError();
      }

      return event;
    } catch (error) {
      throw wrapCalendarEventError("Unable to load the calendar event.", error);
    }
  }

  async getEventOccurrence(
    seriesId: string,
    originalDateInput: string
  ): Promise<CalendarEventOccurrence> {
    const originalDate = requireLocalDate(originalDateInput);

    try {
      const event = await this.storage.getEventById(seriesId);

      if (!event || (!event.recurrence && event.date !== originalDate)) {
        throw new CalendarEventNotFoundError();
      }

      if (
        event.recurrence &&
        !isRecurrenceDate(event.date, event.recurrence, originalDate)
      ) {
        throw new CalendarEventNotFoundError();
      }

      const exceptions = await this.storage.getExceptionsForSeries([seriesId]);
      const exception =
        exceptions.find((item) => item.originalDate === originalDate) ?? null;
      const occurrence = materializeCalendarEventOccurrence(
        event,
        originalDate,
        exception
      );

      if (!occurrence) {
        throw new CalendarEventNotFoundError("This calendar occurrence was removed.");
      }

      return occurrence;
    } catch (error) {
      throw wrapCalendarEventError("Unable to load the calendar occurrence.", error);
    }
  }

  async updateEvent(
    seriesId: string,
    originalDateInput: string,
    scope: CalendarEventEditScope,
    input: UpdateCalendarEventInput
  ): Promise<CalendarEventOccurrence> {
    const originalDate = requireLocalDate(originalDateInput);
    const now = this.clock();
    const timestamp = now.toISOString();

    try {
      const existingEvent = await this.requireStoredEvent(seriesId);
      const previousExceptions = await this.storage.getExceptionsForSeries([seriesId]);
      const existingException =
        previousExceptions.find((item) => item.originalDate === originalDate) ?? null;
      const occurrence = materializeCalendarEventOccurrence(
        existingEvent,
        originalDate,
        existingException
      );

      if (!occurrence) {
        throw new CalendarEventNotFoundError("This calendar occurrence was removed.");
      }

      const normalizedInput = normalizeCalendarEventInput(
        existingEvent.recurrence && scope === "this"
          ? { ...input, recurrence: null }
          : input
      );
      validateNewReminders(normalizedInput, now, occurrence.reminders);

      if (!existingEvent.recurrence || scope === "all") {
        return this.updateWholeEvent(
          existingEvent,
          occurrence,
          previousExceptions,
          normalizedInput,
          timestamp
        );
      }

      if (scope === "this") {
        const exception = buildModifiedException(
          existingEvent,
          occurrence,
          normalizedInput,
          existingException,
          timestamp
        );
        await this.storage.applyEventMutation({ upsertExceptions: [exception] });
        const currentExceptions = replaceException(previousExceptions, exception);
        await this.reminderSynchronizer.syncEventReminder(
          existingEvent,
          existingEvent,
          currentExceptions,
          previousExceptions
        );

        return materializeCalendarEventOccurrence(
          existingEvent,
          originalDate,
          exception
        )!;
      }

      return this.updateFutureEvents(
        existingEvent,
        originalDate,
        previousExceptions,
        normalizedInput,
        timestamp
      );
    } catch (error) {
      throw wrapCalendarEventError("Unable to update the calendar event.", error);
    }
  }

  async deleteEvent(
    seriesId: string,
    originalDateInput: string,
    scope: CalendarEventEditScope
  ): Promise<void> {
    const originalDate = requireLocalDate(originalDateInput);
    const timestamp = this.clock().toISOString();

    try {
      const event = await this.requireStoredEvent(seriesId);
      const previousExceptions = await this.storage.getExceptionsForSeries([seriesId]);

      if (!event.recurrence || scope === "all") {
        await this.storage.applyEventMutation({ deleteEventIds: [event.id] });
        await this.reminderSynchronizer.syncEventReminder(
          null,
          event,
          [],
          previousExceptions
        );
        return;
      }

      if (scope === "this") {
        const existing =
          previousExceptions.find((item) => item.originalDate === originalDate) ?? null;
        const exception: CalendarEventException = {
          id: getCalendarOccurrenceId(event.id, originalDate),
          seriesId: event.id,
          originalDate,
          status: "cancelled",
          overrides: {},
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp
        };
        await this.storage.applyEventMutation({ upsertExceptions: [exception] });
        await this.reminderSynchronizer.syncEventReminder(
          event,
          event,
          replaceException(previousExceptions, exception),
          previousExceptions
        );
        return;
      }

      const futureExceptionIds = previousExceptions
        .filter((exception) => exception.originalDate >= originalDate)
        .map((exception) => exception.id);

      if (hasOccurrenceBefore(event.date, event.recurrence, originalDate)) {
        const truncatedEvent: CalendarEvent = {
          ...event,
          recurrence: {
            ...event.recurrence,
            end: getRecurrenceEndBefore(originalDate)
          },
          updatedAt: timestamp
        };
        await this.storage.applyEventMutation({
          updateEvents: [truncatedEvent],
          deleteExceptionIds: futureExceptionIds
        });
        await this.reminderSynchronizer.syncEventReminder(
          truncatedEvent,
          event,
          previousExceptions.filter((item) => item.originalDate < originalDate),
          previousExceptions
        );
      } else {
        await this.storage.applyEventMutation({ deleteEventIds: [event.id] });
        await this.reminderSynchronizer.syncEventReminder(
          null,
          event,
          [],
          previousExceptions
        );
      }
    } catch (error) {
      throw wrapCalendarEventError("Unable to remove the calendar event.", error);
    }
  }

  async getEventsForDate(date: string): Promise<CalendarEventOccurrence[]> {
    const normalizedDate = requireLocalDate(date);
    return this.getEventsForRange(normalizedDate, normalizedDate);
  }

  async getEventsForRange(
    startDate: string,
    endDate: string
  ): Promise<CalendarEventOccurrence[]> {
    const normalizedStartDate = requireLocalDate(startDate);
    const normalizedEndDate = requireLocalDate(endDate);

    if (normalizedEndDate < normalizedStartDate) {
      throw new CalendarEventValidationError(
        "The end date must not be earlier than the start date.",
        "date"
      );
    }

    try {
      const events = await this.storage.getEventSeriesForRange(
        normalizedStartDate,
        normalizedEndDate
      );
      const exceptions = await this.storage.getExceptionsForSeries(
        events.filter((event) => event.recurrence !== null).map((event) => event.id)
      );

      return expandCalendarEventsForRange(
        events,
        exceptions,
        normalizedStartDate,
        normalizedEndDate
      );
    } catch (error) {
      throw wrapCalendarEventError("Unable to load calendar events.", error);
    }
  }

  private async updateWholeEvent(
    existingEvent: CalendarEvent,
    occurrence: CalendarEventOccurrence,
    previousExceptions: CalendarEventException[],
    input: NormalizedCalendarEventInput,
    timestamp: string
  ): Promise<CalendarEventOccurrence> {
    const keepAnchor =
      existingEvent.recurrence !== null && input.date === occurrence.date;
    const date = keepAnchor
      ? existingEvent.date
      : shiftSeriesAnchor(existingEvent.date, occurrence.date, input.date);
    const recurrence = input.recurrence
      ? normalizeRecurrenceRule(input.recurrence, date)
      : null;
    const updatedEvent: CalendarEvent = {
      ...existingEvent,
      ...input,
      date,
      recurrence,
      updatedAt: timestamp
    };
    const validExceptions = recurrence
      ? previousExceptions.filter((exception) =>
          isRecurrenceDate(date, recurrence, exception.originalDate)
        )
      : [];
    const deletedExceptionIds = previousExceptions
      .filter((exception) => !validExceptions.includes(exception))
      .map((exception) => exception.id);

    await this.storage.applyEventMutation({
      updateEvents: [updatedEvent],
      deleteExceptionIds: deletedExceptionIds
    });
    await this.reminderSynchronizer.syncEventReminder(
      updatedEvent,
      existingEvent,
      validExceptions,
      previousExceptions
    );

    const resultOriginalDate = recurrence
      ? originalDateForUpdatedSeries(occurrence, input)
      : date;
    return (
      materializeCalendarEventOccurrence(updatedEvent, resultOriginalDate, null) ??
      materializeCalendarEventOccurrence(updatedEvent, date, null)!
    );
  }

  private async updateFutureEvents(
    existingEvent: CalendarEvent,
    originalDate: CalendarEventOccurrence["originalDate"],
    previousExceptions: CalendarEventException[],
    input: NormalizedCalendarEventInput,
    timestamp: string
  ): Promise<CalendarEventOccurrence> {
    if (!existingEvent.recurrence) {
      throw new CalendarEventValidationError(
        "This event does not have future occurrences.",
        "recurrence"
      );
    }

    const newEvent: CalendarEvent = {
      id: this.idGenerator(),
      kind: "fixed",
      ...input,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const futureExceptionIds = previousExceptions
      .filter((exception) => exception.originalDate >= originalDate)
      .map((exception) => exception.id);
    const mutation = {
      insertEvents: [newEvent],
      updateEvents: [] as CalendarEvent[],
      deleteEventIds: [] as string[],
      deleteExceptionIds: futureExceptionIds
    };
    let currentOldEvent: CalendarEvent | null = null;

    if (hasOccurrenceBefore(existingEvent.date, existingEvent.recurrence, originalDate)) {
      currentOldEvent = {
        ...existingEvent,
        recurrence: {
          ...existingEvent.recurrence,
          end: getRecurrenceEndBefore(originalDate)
        },
        updatedAt: timestamp
      };
      mutation.updateEvents.push(currentOldEvent);
    } else {
      mutation.deleteEventIds.push(existingEvent.id);
    }

    await this.storage.applyEventMutation(mutation);
    const remainingExceptions = previousExceptions.filter(
      (exception) => exception.originalDate < originalDate
    );
    await this.reminderSynchronizer.syncEventReminder(
      currentOldEvent,
      existingEvent,
      remainingExceptions,
      previousExceptions
    );
    await this.reminderSynchronizer.syncEventReminder(newEvent, undefined, [], []);

    return materializeCalendarEventOccurrence(newEvent, newEvent.date, null)!;
  }

  private async requireStoredEvent(id: string): Promise<CalendarEvent> {
    const event = await this.storage.getEventById(id);

    if (!event) {
      throw new CalendarEventNotFoundError();
    }

    return event;
  }
}

function normalizeCalendarEventInput(
  input: CreateCalendarEventInput | UpdateCalendarEventInput
): NormalizedCalendarEventInput {
  const title = input.title.trim();

  if (!title) {
    throw new CalendarEventValidationError("Enter an event title.", "title");
  }

  const date = normalizeLocalDateInput(input.date);

  if (!date) {
    throw new CalendarEventValidationError(
      "Use an event date in YYYY-MM-DD format.",
      "date"
    );
  }

  const startTime = normalizeOptionalTime(input.startTime);

  if (!startTime) {
    throw new CalendarEventValidationError(
      "Use a start time in HH:MM format.",
      "startTime"
    );
  }

  const rawEndTime = input.endTime?.trim() ?? "";
  const endTime = normalizeOptionalTime(rawEndTime);

  if (rawEndTime && !endTime) {
    throw new CalendarEventValidationError("Use an end time in HH:MM format.", "endTime");
  }

  if (endTime && endTime < startTime) {
    throw new CalendarEventValidationError(
      "The end time must not be earlier than the start time.",
      "endTime"
    );
  }

  const durationMinutes = input.durationMinutes ?? null;

  if (
    durationMinutes !== null &&
    (!Number.isInteger(durationMinutes) || durationMinutes <= 0)
  ) {
    throw new CalendarEventValidationError(
      "Duration must be a whole number of minutes greater than zero.",
      "durationMinutes"
    );
  }

  if (endTime && durationMinutes !== null) {
    throw new CalendarEventValidationError(
      "Use either an end time or a duration, not both.",
      "durationMinutes"
    );
  }

  const color = input.color ?? "neutral";

  if (!isItemColor(color)) {
    throw new CalendarEventValidationError("Choose an available color.", "color");
  }

  const reminderOffsets = input.reminderOffsets ?? [];

  if (!isReminderOffsetList(reminderOffsets)) {
    throw new CalendarEventValidationError(
      "Choose up to five different reminder times.",
      "reminderOffsets"
    );
  }

  let reminders: CalendarEvent["reminders"];

  try {
    reminders = normalizeReminders(
      input.reminders ?? remindersFromOffsets(normalizeReminderOffsets(reminderOffsets))
    );
  } catch (error) {
    throw new CalendarEventValidationError(
      error instanceof Error ? error.message : "Choose valid reminder times.",
      "reminders"
    );
  }

  let recurrence: CalendarEvent["recurrence"];

  try {
    recurrence = normalizeRecurrenceRule(input.recurrence ?? null, date);
  } catch (error) {
    throw new CalendarEventValidationError(
      error instanceof Error ? error.message : "Choose a valid repeat pattern.",
      "recurrence"
    );
  }

  return {
    title,
    date,
    startTime,
    endTime,
    durationMinutes,
    notes: input.notes?.trim() || null,
    color,
    reminders,
    reminderOffsets: getRelativeReminderOffsets(reminders),
    recurrence
  };
}

function validateNewReminders(
  input: NormalizedCalendarEventInput,
  now: Date,
  previousReminders: readonly CalendarEvent["reminders"][number][] = []
): void {
  if (!input.recurrence && input.reminderOffsets.length > 0) {
    const eventDate = getReminderTriggerDate(input.date, input.startTime, 0);

    if (!eventDate || eventDate.getTime() <= now.getTime()) {
      throw new CalendarEventValidationError(
        "Choose a future event time for this reminder.",
        "reminderOffsets"
      );
    }
  }

  const previousKeys = new Set(previousReminders.map(getReminderKey));

  for (const reminder of input.reminders) {
    if (reminder.kind !== "absolute" || previousKeys.has(getReminderKey(reminder))) {
      continue;
    }

    const reminderDate = getReminderDate(reminder, null, null);

    if (!reminderDate || reminderDate.getTime() <= now.getTime()) {
      throw new CalendarEventValidationError(
        "Choose a future date and time for a custom reminder.",
        "reminders"
      );
    }
  }
}

function buildModifiedException(
  event: CalendarEvent,
  occurrence: CalendarEventOccurrence,
  input: NormalizedCalendarEventInput,
  existing: CalendarEventException | null,
  timestamp: string
): CalendarEventException {
  const overrides: CalendarEventException["overrides"] = {};
  const baseOccurrence = materializeCalendarEventOccurrence(
    event,
    occurrence.originalDate,
    null
  )!;
  const fields = [
    "title",
    "date",
    "startTime",
    "endTime",
    "durationMinutes",
    "notes",
    "color"
  ] as const;

  for (const field of fields) {
    if (input[field] !== baseOccurrence[field]) {
      Object.assign(overrides, { [field]: input[field] });
    }
  }

  if (JSON.stringify(input.reminders) !== JSON.stringify(baseOccurrence.reminders)) {
    overrides.reminders = input.reminders;
  }

  return {
    id: getCalendarOccurrenceId(event.id, occurrence.originalDate),
    seriesId: event.id,
    originalDate: occurrence.originalDate,
    status: "modified",
    overrides,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp
  };
}

function replaceException(
  exceptions: CalendarEventException[],
  replacement: CalendarEventException
): CalendarEventException[] {
  return [
    ...exceptions.filter(
      (exception) => exception.originalDate !== replacement.originalDate
    ),
    replacement
  ];
}

function shiftSeriesAnchor(
  anchorDate: CalendarEvent["date"],
  occurrenceDate: CalendarEvent["date"],
  nextOccurrenceDate: CalendarEvent["date"]
): CalendarEvent["date"] {
  const difference = civilDayDifference(occurrenceDate, nextOccurrenceDate);
  return addLocalDays(anchorDate, difference);
}

function originalDateForUpdatedSeries(
  occurrence: CalendarEventOccurrence,
  input: NormalizedCalendarEventInput
): CalendarEvent["date"] {
  return addLocalDays(
    occurrence.originalDate,
    civilDayDifference(occurrence.date, input.date)
  );
}

function civilDayDifference(
  first: CalendarEvent["date"],
  second: CalendarEvent["date"]
): number {
  const [firstYear, firstMonth, firstDay] = first.split("-").map(Number);
  const [secondYear, secondMonth, secondDay] = second.split("-").map(Number);

  return Math.round(
    (Date.UTC(secondYear!, secondMonth! - 1, secondDay!) -
      Date.UTC(firstYear!, firstMonth! - 1, firstDay!)) /
      (24 * 60 * 60 * 1000)
  );
}

function requireLocalDate(date: string) {
  const normalizedDate = normalizeLocalDateInput(date);

  if (!normalizedDate) {
    throw new CalendarEventValidationError("Use a date in YYYY-MM-DD format.", "date");
  }

  return normalizedDate;
}

function wrapCalendarEventError(message: string, error: unknown): Error {
  if (
    error instanceof CalendarEventValidationError ||
    error instanceof CalendarEventNotFoundError ||
    error instanceof CalendarEventPersistenceError
  ) {
    return error;
  }

  return new CalendarEventPersistenceError(message, error);
}

export { compareCalendarEventOccurrences };

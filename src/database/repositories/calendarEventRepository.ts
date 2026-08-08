import { CalendarEvent, CreateCalendarEventInput } from "../../types/calendarEvent";
import {
  getReminderTriggerDate,
  isReminderOffsetMinutes
} from "../../notifications/reminderRules";
import {
  noOpReminderSynchronizer,
  ReminderSynchronizer
} from "../../notifications/reminderSynchronizer";
import { normalizeLocalDateInput, normalizeOptionalTime } from "../../utils/dates";
import { createCalendarEventId } from "../../utils/ids";
import { CalendarEventStorage } from "../calendarEventStorage";
import {
  CalendarEventPersistenceError,
  CalendarEventValidationError
} from "./calendarEventErrors";

type Clock = () => Date;
type IdGenerator = () => string;

export class CalendarEventRepository {
  constructor(
    private readonly storage: CalendarEventStorage,
    private readonly idGenerator: IdGenerator = createCalendarEventId,
    private readonly clock: Clock = () => new Date(),
    private readonly reminderSynchronizer: ReminderSynchronizer = noOpReminderSynchronizer
  ) {}

  async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    const normalizedInput = normalizeCreateEventInput(input);
    const now = this.clock();
    const timestamp = now.toISOString();

    if (normalizedInput.reminderOffsetMinutes !== null) {
      const reminderDate = getReminderTriggerDate(
        normalizedInput.date,
        normalizedInput.startTime,
        normalizedInput.reminderOffsetMinutes
      );

      if (!reminderDate || reminderDate.getTime() <= now.getTime()) {
        throw new CalendarEventValidationError(
          "Choose a future event time for this reminder.",
          "reminderOffsetMinutes"
        );
      }
    }

    const event: CalendarEvent = {
      id: this.idGenerator(),
      title: normalizedInput.title,
      kind: "fixed",
      date: normalizedInput.date,
      startTime: normalizedInput.startTime,
      endTime: normalizedInput.endTime,
      durationMinutes: normalizedInput.durationMinutes,
      notes: normalizedInput.notes,
      reminderOffsetMinutes: normalizedInput.reminderOffsetMinutes,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    try {
      await this.storage.insertEvent(event);
    } catch (error) {
      throw new CalendarEventPersistenceError("Unable to save the event.", error);
    }

    await this.reminderSynchronizer.syncEventReminder(event);

    return event;
  }

  async getEventsForDate(date: string): Promise<CalendarEvent[]> {
    const normalizedDate = requireLocalDate(date);

    try {
      const events = await this.storage.getEventsForDate(normalizedDate);

      return events.sort(compareCalendarEvents);
    } catch (error) {
      throw new CalendarEventPersistenceError(
        "Unable to load events for the selected date.",
        error
      );
    }
  }

  async getEventsForRange(startDate: string, endDate: string): Promise<CalendarEvent[]> {
    const normalizedStartDate = requireLocalDate(startDate);
    const normalizedEndDate = requireLocalDate(endDate);

    if (normalizedEndDate < normalizedStartDate) {
      throw new CalendarEventValidationError(
        "The end date must not be earlier than the start date.",
        "date"
      );
    }

    try {
      const events = await this.storage.getEventsForRange(
        normalizedStartDate,
        normalizedEndDate
      );

      return events.sort(compareCalendarEvents);
    } catch (error) {
      throw new CalendarEventPersistenceError("Unable to load calendar events.", error);
    }
  }
}

function normalizeCreateEventInput(
  input: CreateCalendarEventInput
): Pick<
  CalendarEvent,
  | "title"
  | "date"
  | "startTime"
  | "endTime"
  | "durationMinutes"
  | "notes"
  | "reminderOffsetMinutes"
> {
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

  const reminderOffsetMinutes = input.reminderOffsetMinutes ?? null;

  if (reminderOffsetMinutes !== null && !isReminderOffsetMinutes(reminderOffsetMinutes)) {
    throw new CalendarEventValidationError(
      "Choose an available reminder time.",
      "reminderOffsetMinutes"
    );
  }

  return {
    title,
    date,
    startTime,
    endTime,
    durationMinutes,
    notes: input.notes?.trim() || null,
    reminderOffsetMinutes
  };
}

function requireLocalDate(date: string) {
  const normalizedDate = normalizeLocalDateInput(date);

  if (!normalizedDate) {
    throw new CalendarEventValidationError("Use a date in YYYY-MM-DD format.", "date");
  }

  return normalizedDate;
}

function compareCalendarEvents(first: CalendarEvent, second: CalendarEvent): number {
  const dateOrder = first.date.localeCompare(second.date);

  if (dateOrder !== 0) {
    return dateOrder;
  }

  const timeOrder = first.startTime.localeCompare(second.startTime);

  if (timeOrder !== 0) {
    return timeOrder;
  }

  return first.createdAt.localeCompare(second.createdAt);
}

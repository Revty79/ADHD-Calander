import { CalendarEvent, CreateCalendarEventInput } from "../../types/calendarEvent";
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
  normalizeReminders,
  remindersFromOffsets
} from "../../notifications/reminders";
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

    if (normalizedInput.reminderOffsets.length > 0) {
      const reminderDate = getReminderTriggerDate(
        normalizedInput.date,
        normalizedInput.startTime,
        0
      );

      if (!reminderDate || reminderDate.getTime() <= now.getTime()) {
        throw new CalendarEventValidationError(
          "Choose a future event time for this reminder.",
          "reminderOffsets"
        );
      }
    }

    for (const reminder of normalizedInput.reminders) {
      if (reminder.kind !== "absolute") {
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

    const event: CalendarEvent = {
      id: this.idGenerator(),
      title: normalizedInput.title,
      kind: "fixed",
      date: normalizedInput.date,
      startTime: normalizedInput.startTime,
      endTime: normalizedInput.endTime,
      durationMinutes: normalizedInput.durationMinutes,
      notes: normalizedInput.notes,
      reminders: normalizedInput.reminders,
      reminderOffsets: normalizedInput.reminderOffsets,
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
  | "reminders"
  | "reminderOffsets"
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

  return {
    title,
    date,
    startTime,
    endTime,
    durationMinutes,
    notes: input.notes?.trim() || null,
    reminders,
    reminderOffsets: getRelativeReminderOffsets(reminders)
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

  return (
    first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id)
  );
}

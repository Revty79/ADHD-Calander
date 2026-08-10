export type CalendarEventValidationField =
  | "title"
  | "date"
  | "startTime"
  | "endTime"
  | "durationMinutes"
  | "reminders"
  | "reminderOffsets";

export class CalendarEventValidationError extends Error {
  readonly field: CalendarEventValidationField;

  constructor(message: string, field: CalendarEventValidationField) {
    super(message);
    this.name = "CalendarEventValidationError";
    this.field = field;
  }
}

export class CalendarEventPersistenceError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "CalendarEventPersistenceError";
    this.cause = cause;
  }
}

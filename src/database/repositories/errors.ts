export type TaskValidationField =
  | "title"
  | "importance"
  | "color"
  | "scheduledDate"
  | "scheduledTime"
  | "preferredTime"
  | "estimatedDurationMinutes"
  | "deadlineDate"
  | "deadlineTime"
  | "reminders"
  | "reminderOffsets"
  | "breakdownTitles";

export class TaskValidationError extends Error {
  readonly field: TaskValidationField;

  constructor(message: string, field: TaskValidationField) {
    super(message);
    this.name = "TaskValidationError";
    this.field = field;
  }
}

export class TaskPersistenceError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "TaskPersistenceError";
    this.cause = cause;
  }
}

export class TaskNotFoundError extends Error {
  constructor(message = "Task was not found.") {
    super(message);
    this.name = "TaskNotFoundError";
  }
}

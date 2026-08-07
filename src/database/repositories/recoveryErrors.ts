export type RecoveryValidationField =
  "sourceDate" | "scheduledDate" | "scheduledTime" | "breakdownTitles" | "session";

export class RecoveryValidationError extends Error {
  readonly field: RecoveryValidationField;

  constructor(message: string, field: RecoveryValidationField) {
    super(message);
    this.name = "RecoveryValidationError";
    this.field = field;
  }
}

export class RecoveryPersistenceError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "RecoveryPersistenceError";
    this.cause = cause;
  }
}

export class RecoveryItemNotFoundError extends Error {
  constructor(message = "Recovery item was not found.") {
    super(message);
    this.name = "RecoveryItemNotFoundError";
  }
}

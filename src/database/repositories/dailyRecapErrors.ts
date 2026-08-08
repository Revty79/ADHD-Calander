export class DailyRecapValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DailyRecapValidationError";
  }
}

export class DailyRecapPersistenceError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "DailyRecapPersistenceError";
    this.cause = cause;
  }
}

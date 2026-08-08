export class SettingsPersistenceError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "SettingsPersistenceError";
    this.cause = cause;
  }
}

export class SettingsValidationError extends Error {
  constructor(
    message: string,
    readonly field:
      | "planningDayStart"
      | "planningDayEnd"
      | "transitionBufferMinutes"
      | "maxSuggestedTaskMinutesPerDay"
  ) {
    super(message);
    this.name = "SettingsValidationError";
  }
}

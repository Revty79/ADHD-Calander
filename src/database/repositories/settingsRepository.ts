import {
  AppSettings,
  defaultAppSettings,
  maxSuggestedTaskMinutesOptions,
  PlanningPreferences,
  transitionBufferOptions
} from "../../types/settings";
import { normalizeOptionalTime } from "../../utils/dates";
import { SettingsStorage } from "../settingsStorage";
import { SettingsPersistenceError, SettingsValidationError } from "./settingsErrors";

type Clock = () => Date;

const remindersEnabledKey = "reminders_enabled";
const planningSettingKeys: Record<keyof PlanningPreferences, string> = {
  planningDayStart: "planning_day_start",
  planningDayEnd: "planning_day_end",
  transitionBufferMinutes: "transition_buffer_minutes",
  maxSuggestedTaskMinutesPerDay: "max_suggested_task_minutes_per_day"
};

export class SettingsRepository {
  constructor(
    private readonly storage: SettingsStorage,
    private readonly clock: Clock = () => new Date()
  ) {}

  async getSettings(): Promise<AppSettings> {
    try {
      const [
        remindersEnabled,
        planningDayStart,
        planningDayEnd,
        transitionBufferMinutes,
        maxSuggestedTaskMinutesPerDay
      ] = await Promise.all([
        this.storage.getSetting(remindersEnabledKey),
        this.storage.getSetting(planningSettingKeys.planningDayStart),
        this.storage.getSetting(planningSettingKeys.planningDayEnd),
        this.storage.getSetting(planningSettingKeys.transitionBufferMinutes),
        this.storage.getSetting(planningSettingKeys.maxSuggestedTaskMinutesPerDay)
      ]);

      return {
        ...defaultAppSettings,
        remindersEnabled:
          remindersEnabled === null
            ? defaultAppSettings.remindersEnabled
            : parseBooleanSetting(remindersEnabled.value),
        planningDayStart: parseTimeSetting(
          planningDayStart?.value,
          defaultAppSettings.planningDayStart
        ),
        planningDayEnd: parseTimeSetting(
          planningDayEnd?.value,
          defaultAppSettings.planningDayEnd
        ),
        transitionBufferMinutes: parseNumberSetting(
          transitionBufferMinutes?.value,
          transitionBufferOptions,
          defaultAppSettings.transitionBufferMinutes
        ),
        maxSuggestedTaskMinutesPerDay: parseNumberSetting(
          maxSuggestedTaskMinutesPerDay?.value,
          maxSuggestedTaskMinutesOptions,
          defaultAppSettings.maxSuggestedTaskMinutesPerDay
        )
      };
    } catch (error) {
      throw new SettingsPersistenceError("Unable to load app settings.", error);
    }
  }

  async setRemindersEnabled(enabled: boolean): Promise<AppSettings> {
    try {
      await this.storage.setSetting({
        key: remindersEnabledKey,
        value: enabled ? "true" : "false",
        updatedAt: this.clock().toISOString()
      });

      return { ...(await this.getSettings()), remindersEnabled: enabled };
    } catch (error) {
      if (error instanceof SettingsPersistenceError) {
        throw error;
      }

      throw new SettingsPersistenceError("Unable to save reminder settings.", error);
    }
  }

  async setPlanningPreference<Key extends keyof PlanningPreferences>(
    key: Key,
    value: PlanningPreferences[Key]
  ): Promise<AppSettings> {
    const current = await this.getSettings();
    const nextPreferences: PlanningPreferences = {
      planningDayStart: current.planningDayStart,
      planningDayEnd: current.planningDayEnd,
      transitionBufferMinutes: current.transitionBufferMinutes,
      maxSuggestedTaskMinutesPerDay: current.maxSuggestedTaskMinutesPerDay,
      [key]: value
    };

    validatePlanningPreferences(nextPreferences, key);

    try {
      await this.storage.setSetting({
        key: planningSettingKeys[key],
        value: String(value),
        updatedAt: this.clock().toISOString()
      });

      return { ...(await this.getSettings()), ...nextPreferences };
    } catch (error) {
      if (
        error instanceof SettingsPersistenceError ||
        error instanceof SettingsValidationError
      ) {
        throw error;
      }

      throw new SettingsPersistenceError("Unable to save planning settings.", error);
    }
  }
}

function parseBooleanSetting(value: string): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error("Stored reminder setting has an invalid value.");
}

function parseTimeSetting(
  value: string | undefined,
  fallback: PlanningPreferences["planningDayStart"]
): PlanningPreferences["planningDayStart"] {
  if (value === undefined) {
    return fallback;
  }

  const normalized = normalizeOptionalTime(value);

  if (!normalized) {
    throw new Error("Stored planning time has an invalid value.");
  }

  return normalized;
}

function parseNumberSetting<const Options extends readonly number[]>(
  value: string | undefined,
  options: Options,
  fallback: Options[number]
): Options[number] {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!options.some((option) => option === parsed)) {
    throw new Error("Stored planning number has an invalid value.");
  }

  return parsed as Options[number];
}

function validatePlanningPreferences(
  preferences: PlanningPreferences,
  changedField: keyof PlanningPreferences
): void {
  const start = normalizeOptionalTime(preferences.planningDayStart);
  const end = normalizeOptionalTime(preferences.planningDayEnd);

  if (!start) {
    throw new SettingsValidationError(
      "Choose a valid planning-day start time.",
      "planningDayStart"
    );
  }

  if (!end) {
    throw new SettingsValidationError(
      "Choose a valid planning-day end time.",
      "planningDayEnd"
    );
  }

  if (start >= end) {
    throw new SettingsValidationError(
      "Planning-day end must be later than its start.",
      changedField === "planningDayStart" ? "planningDayStart" : "planningDayEnd"
    );
  }

  if (!transitionBufferOptions.includes(preferences.transitionBufferMinutes)) {
    throw new SettingsValidationError(
      "Choose an available transition buffer.",
      "transitionBufferMinutes"
    );
  }

  if (
    !maxSuggestedTaskMinutesOptions.includes(preferences.maxSuggestedTaskMinutesPerDay)
  ) {
    throw new SettingsValidationError(
      "Choose an available daily task-time limit.",
      "maxSuggestedTaskMinutesPerDay"
    );
  }
}

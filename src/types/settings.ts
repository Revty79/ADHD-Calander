import { LocalTimeString } from "./dateTime";

export const transitionBufferOptions = [0, 15, 30] as const;
export const maxSuggestedTaskMinutesOptions = [120, 180, 240] as const;
export const planningDayStartOptions = ["07:00", "08:00", "09:00"] as const;
export const planningDayEndOptions = ["18:00", "20:00", "22:00"] as const;

export type TransitionBufferMinutes = (typeof transitionBufferOptions)[number];
export type MaxSuggestedTaskMinutes = (typeof maxSuggestedTaskMinutesOptions)[number];

export type PlanningPreferences = {
  planningDayStart: LocalTimeString;
  planningDayEnd: LocalTimeString;
  transitionBufferMinutes: TransitionBufferMinutes;
  maxSuggestedTaskMinutesPerDay: MaxSuggestedTaskMinutes;
};

export type AppSettings = PlanningPreferences & {
  remindersEnabled: boolean;
};

export const defaultAppSettings: AppSettings = {
  remindersEnabled: false,
  planningDayStart: "08:00",
  planningDayEnd: "20:00",
  transitionBufferMinutes: 15,
  maxSuggestedTaskMinutesPerDay: 180
};

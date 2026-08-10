import { LocalDateString, LocalTimeString } from "./dateTime";

export const reminderOffsetOptions = [0, 5, 10, 15, 30, 60, 1440] as const;

export const reminderSelectionOptions = [1440, 60, 30, 15, 5, 0] as const;

export const maxRemindersPerItem = 5;

export type ReminderOffsetMinutes = (typeof reminderOffsetOptions)[number];

export type RelativeReminder = {
  kind: "relative";
  offsetMinutes: ReminderOffsetMinutes;
};

export type AbsoluteReminder = {
  kind: "absolute";
  date: LocalDateString;
  time: LocalTimeString;
};

export type Reminder = RelativeReminder | AbsoluteReminder;

export type ReminderInput =
  | { kind: "relative"; offsetMinutes: number }
  | { kind: "absolute"; date: string; time: string };

export type ReminderPermissionStatus =
  "granted" | "denied" | "undetermined" | "unsupported";

export type ReminderNotificationRequest = {
  identifier: string;
  title: string;
  body: string;
  triggerDate: Date;
  itemType: "task" | "event";
  itemId: string;
};

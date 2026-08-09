export const reminderOffsetOptions = [0, 10, 15, 30, 60, 1440] as const;

export const reminderSelectionOptions = [1440, 60, 30, 15, 10, 0] as const;

export const maxRemindersPerItem = 5;

export type ReminderOffsetMinutes = (typeof reminderOffsetOptions)[number];

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

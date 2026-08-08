export const reminderOffsetOptions = [0, 10, 30, 60] as const;

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

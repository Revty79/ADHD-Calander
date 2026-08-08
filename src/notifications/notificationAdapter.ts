import { ReminderNotificationRequest, ReminderPermissionStatus } from "../types/reminder";

export type NotificationAdapter = {
  getPermissionStatus(): Promise<ReminderPermissionStatus>;
  requestPermission(): Promise<ReminderPermissionStatus>;
  scheduleReminder(request: ReminderNotificationRequest): Promise<void>;
  cancelReminder(identifier: string): Promise<void>;
  cancelAllReminders(): Promise<void>;
};

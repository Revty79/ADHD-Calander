import { NotificationAdapter } from "./notificationAdapter";

export class UnsupportedNotificationAdapter implements NotificationAdapter {
  async getPermissionStatus() {
    return "unsupported" as const;
  }

  async requestPermission() {
    return "unsupported" as const;
  }

  async scheduleReminder() {}

  async cancelReminder() {}

  async cancelAllReminders() {}
}

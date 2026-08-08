import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { ReminderNotificationRequest, ReminderPermissionStatus } from "../types/reminder";
import { NotificationAdapter } from "./notificationAdapter";

const reminderChannelId = "planning-reminders";

export class ExpoNotificationAdapter implements NotificationAdapter {
  constructor() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true
      })
    });
  }

  async getPermissionStatus(): Promise<ReminderPermissionStatus> {
    const permissions = await Notifications.getPermissionsAsync();

    return mapPermissionStatus(permissions.status);
  }

  async requestPermission(): Promise<ReminderPermissionStatus> {
    await this.prepareAndroidChannel();
    const permissions = await Notifications.requestPermissionsAsync({
      android: {},
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: false
      }
    });

    return mapPermissionStatus(permissions.status);
  }

  async scheduleReminder(request: ReminderNotificationRequest): Promise<void> {
    await this.prepareAndroidChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: request.identifier,
      content: {
        title: request.title,
        body: request.body,
        data: {
          itemType: request.itemType,
          itemId: request.itemId
        }
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: request.triggerDate,
        ...(Platform.OS === "android" ? { channelId: reminderChannelId } : {})
      }
    });
  }

  async cancelReminder(identifier: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }

  async cancelAllReminders(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  private async prepareAndroidChannel(): Promise<void> {
    if (Platform.OS !== "android") {
      return;
    }

    await Notifications.setNotificationChannelAsync(reminderChannelId, {
      name: "Planning reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: [0, 180]
    });
  }
}

function mapPermissionStatus(
  status: Notifications.PermissionStatus
): ReminderPermissionStatus {
  switch (status) {
    case Notifications.PermissionStatus.GRANTED:
      return "granted";
    case Notifications.PermissionStatus.DENIED:
      return "denied";
    default:
      return "undetermined";
  }
}

import { CalendarEventStorage } from "../database/calendarEventStorage";
import { SettingsRepository } from "../database/repositories/settingsRepository";
import { TaskStorage } from "../database/taskStorage";
import { CalendarEvent } from "../types/calendarEvent";
import { ReminderNotificationRequest, ReminderPermissionStatus } from "../types/reminder";
import { AppSettings } from "../types/settings";
import { Task } from "../types/task";
import { NotificationAdapter } from "./notificationAdapter";
import {
  buildEventReminderRequests,
  buildTaskReminderRequests,
  getAllEventReminderIdentifiers,
  getAllTaskReminderIdentifiers
} from "./reminderRules";
import { ReminderSynchronizer } from "./reminderSynchronizer";

type Clock = () => Date;

export type ReminderServiceStatus = {
  settings: AppSettings;
  permissionStatus: ReminderPermissionStatus;
};

export class ReminderService implements ReminderSynchronizer {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly taskStorage: TaskStorage,
    private readonly calendarEventStorage: CalendarEventStorage,
    private readonly notificationAdapter: NotificationAdapter,
    private readonly clock: Clock = () => new Date()
  ) {}

  async getStatus(): Promise<ReminderServiceStatus> {
    const [settings, permissionStatus] = await Promise.all([
      this.settingsRepository.getSettings(),
      this.notificationAdapter.getPermissionStatus()
    ]);

    return { settings, permissionStatus };
  }

  async setRemindersEnabled(enabled: boolean): Promise<ReminderServiceStatus> {
    if (!enabled) {
      const settings = await this.settingsRepository.setRemindersEnabled(false);
      await this.notificationAdapter.cancelAllReminders();

      return {
        settings,
        permissionStatus: await this.notificationAdapter.getPermissionStatus()
      };
    }

    let permissionStatus = await this.notificationAdapter.getPermissionStatus();

    if (permissionStatus === "undetermined") {
      permissionStatus = await this.notificationAdapter.requestPermission();
    }

    if (permissionStatus !== "granted") {
      const settings = await this.settingsRepository.setRemindersEnabled(false);
      await this.notificationAdapter.cancelAllReminders();

      return { settings, permissionStatus };
    }

    const settings = await this.settingsRepository.setRemindersEnabled(true);
    await this.reconcileAll();

    return { settings, permissionStatus };
  }

  async reconcileAll(): Promise<void> {
    try {
      const settings = await this.settingsRepository.getSettings();

      await this.notificationAdapter.cancelAllReminders();

      if (!settings.remindersEnabled) {
        return;
      }

      const permissionStatus = await this.notificationAdapter.getPermissionStatus();

      if (permissionStatus !== "granted") {
        await this.settingsRepository.setRemindersEnabled(false);
        return;
      }

      const [tasks, events] = await Promise.all([
        this.taskStorage.getAllTasks(),
        this.calendarEventStorage.getAllEvents()
      ]);

      for (const task of tasks) {
        for (const request of buildTaskReminderRequests(task)) {
          await this.scheduleIfFuture(request);
        }
      }

      for (const event of events) {
        for (const request of buildEventReminderRequests(event)) {
          await this.scheduleIfFuture(request);
        }
      }
    } catch (error) {
      console.error("Reminder reconciliation failed", error);
    }
  }

  async syncTaskReminder(task: Task, previousTask?: Task): Promise<void> {
    await this.safelySynchronize(
      uniqueIdentifiers([
        ...getAllTaskReminderIdentifiers(task.id, task.reminders),
        ...getAllTaskReminderIdentifiers(task.id, previousTask?.reminders ?? [])
      ]),
      buildTaskReminderRequests(task)
    );
  }

  async syncEventReminder(
    event: CalendarEvent,
    previousEvent?: CalendarEvent
  ): Promise<void> {
    await this.safelySynchronize(
      uniqueIdentifiers([
        ...getAllEventReminderIdentifiers(event.id, event.reminders),
        ...getAllEventReminderIdentifiers(event.id, previousEvent?.reminders ?? [])
      ]),
      buildEventReminderRequests(event)
    );
  }

  private async safelySynchronize(
    identifiers: string[],
    requests: ReminderNotificationRequest[]
  ): Promise<void> {
    try {
      for (const identifier of identifiers) {
        await this.notificationAdapter.cancelReminder(identifier);
      }

      if (requests.length === 0) {
        return;
      }

      const { settings, permissionStatus } = await this.getStatus();

      if (!settings.remindersEnabled || permissionStatus !== "granted") {
        return;
      }

      for (const request of requests) {
        await this.scheduleIfFuture(request);
      }
    } catch (error) {
      console.error("Reminder synchronization failed", error);
    }
  }

  private async scheduleIfFuture(
    request: ReminderNotificationRequest | null
  ): Promise<void> {
    if (!request || request.triggerDate.getTime() <= this.clock().getTime()) {
      return;
    }

    await this.notificationAdapter.scheduleReminder(request);
  }
}

function uniqueIdentifiers(identifiers: string[]): string[] {
  return [...new Set(identifiers)];
}

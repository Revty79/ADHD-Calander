import { CalendarEvent } from "../types/calendarEvent";
import { Task } from "../types/task";

export type ReminderSynchronizer = {
  syncTaskReminder(task: Task, previousTask?: Task): Promise<void>;
  syncEventReminder(event: CalendarEvent, previousEvent?: CalendarEvent): Promise<void>;
};

export const noOpReminderSynchronizer: ReminderSynchronizer = {
  async syncTaskReminder() {},
  async syncEventReminder() {}
};

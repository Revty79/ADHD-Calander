import { CalendarEvent } from "../types/calendarEvent";
import { Task } from "../types/task";

export type ReminderSynchronizer = {
  syncTaskReminder(task: Task): Promise<void>;
  syncEventReminder(event: CalendarEvent): Promise<void>;
};

export const noOpReminderSynchronizer: ReminderSynchronizer = {
  async syncTaskReminder() {},
  async syncEventReminder() {}
};

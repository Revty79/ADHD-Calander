import { CalendarEvent, CalendarEventException } from "../types/calendarEvent";
import { Task } from "../types/task";

export type ReminderSynchronizer = {
  syncTaskReminder(task: Task, previousTask?: Task): Promise<void>;
  syncEventReminder(
    event: CalendarEvent | null,
    previousEvent?: CalendarEvent,
    exceptions?: CalendarEventException[],
    previousExceptions?: CalendarEventException[]
  ): Promise<void>;
};

export const noOpReminderSynchronizer: ReminderSynchronizer = {
  async syncTaskReminder() {},
  async syncEventReminder() {}
};

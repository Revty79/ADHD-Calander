import { LocalDateString, LocalTimeString } from "./dateTime";
import { Reminder, ReminderInput, ReminderOffsetMinutes } from "./reminder";

export const calendarEventKinds = ["fixed"] as const;

export type CalendarEventKind = (typeof calendarEventKinds)[number];

export type CalendarEvent = {
  id: string;
  title: string;
  kind: CalendarEventKind;
  date: LocalDateString;
  startTime: LocalTimeString;
  endTime: LocalTimeString | null;
  durationMinutes: number | null;
  notes: string | null;
  reminders: Reminder[];
  reminderOffsets: ReminderOffsetMinutes[];
  createdAt: string;
  updatedAt: string;
};

export type CreateCalendarEventInput = {
  title: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  notes?: string | null;
  reminders?: ReminderInput[];
  reminderOffsets?: number[];
};

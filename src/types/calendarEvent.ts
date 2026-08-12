import { LocalDateString, LocalTimeString } from "./dateTime";
import { ItemColor } from "./itemColor";
import { Reminder, ReminderInput, ReminderOffsetMinutes } from "./reminder";

export const calendarEventKinds = ["fixed"] as const;

export type CalendarEventKind = (typeof calendarEventKinds)[number];

export type CalendarWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RecurrenceEnd =
  | { kind: "never" }
  | { kind: "on_date"; date: LocalDateString }
  | { kind: "after_count"; count: number };

export type CalendarRecurrenceRule =
  | {
      frequency: "daily";
      interval: number;
      end: RecurrenceEnd;
    }
  | {
      frequency: "weekly";
      interval: number;
      weekdays: CalendarWeekday[];
      end: RecurrenceEnd;
    }
  | {
      frequency: "monthly";
      interval: number;
      monthlyPattern:
        | { kind: "same_date" }
        | {
            kind: "ordinal_weekday";
            ordinal: 1 | 2 | 3 | 4 | -1;
            weekday: CalendarWeekday;
          };
      end: RecurrenceEnd;
    }
  | {
      frequency: "yearly";
      interval: number;
      end: RecurrenceEnd;
    };

export type CalendarEvent = {
  id: string;
  title: string;
  kind: CalendarEventKind;
  date: LocalDateString;
  startTime: LocalTimeString;
  endTime: LocalTimeString | null;
  durationMinutes: number | null;
  notes: string | null;
  color: ItemColor;
  reminders: Reminder[];
  reminderOffsets: ReminderOffsetMinutes[];
  recurrence: CalendarRecurrenceRule | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarEventOccurrence = CalendarEvent & {
  seriesId: string;
  originalDate: LocalDateString;
  isRecurring: boolean;
};

export type CalendarEventOverride = Partial<
  Pick<
    CalendarEvent,
    | "title"
    | "date"
    | "startTime"
    | "endTime"
    | "durationMinutes"
    | "notes"
    | "color"
    | "reminders"
  >
>;

export type CalendarEventException = {
  id: string;
  seriesId: string;
  originalDate: LocalDateString;
  status: "modified" | "cancelled";
  overrides: CalendarEventOverride;
  createdAt: string;
  updatedAt: string;
};

export type CalendarEventEditScope = "this" | "future" | "all";

export type CreateCalendarEventInput = {
  title: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  notes?: string | null;
  color?: ItemColor;
  reminders?: ReminderInput[];
  reminderOffsets?: number[];
  recurrence?: CalendarRecurrenceRule | null;
};

export type UpdateCalendarEventInput = CreateCalendarEventInput;

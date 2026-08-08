import { CalendarEvent } from "../types/calendarEvent";

export type CalendarEventStorage = {
  insertEvent(event: CalendarEvent): Promise<void>;
  getEventsForDate(date: string): Promise<CalendarEvent[]>;
  getEventsForRange(startDate: string, endDate: string): Promise<CalendarEvent[]>;
  getAllEvents(): Promise<CalendarEvent[]>;
};

import { CalendarEvent, CalendarEventException } from "../types/calendarEvent";

export type CalendarEventMutation = {
  insertEvents?: CalendarEvent[];
  updateEvents?: CalendarEvent[];
  deleteEventIds?: string[];
  upsertExceptions?: CalendarEventException[];
  deleteExceptionIds?: string[];
};

export type CalendarEventStorage = {
  insertEvent(event: CalendarEvent): Promise<void>;
  getEventById(id: string): Promise<CalendarEvent | null>;
  getEventsForDate(date: string): Promise<CalendarEvent[]>;
  getEventsForRange(startDate: string, endDate: string): Promise<CalendarEvent[]>;
  getEventSeriesForRange(startDate: string, endDate: string): Promise<CalendarEvent[]>;
  getAllEvents(): Promise<CalendarEvent[]>;
  getExceptionsForSeries(seriesIds: string[]): Promise<CalendarEventException[]>;
  applyEventMutation(mutation: CalendarEventMutation): Promise<void>;
};

import { CalendarEvent, CalendarEventKind } from "../types/calendarEvent";
import { LocalDateString, LocalTimeString } from "../types/dateTime";
import { CalendarEventStorage } from "./calendarEventStorage";
import { SqlExecutor } from "./sql";

type CalendarEventRow = {
  id: string;
  title: string;
  kind: CalendarEventKind;
  date: LocalDateString;
  startTime: LocalTimeString;
  endTime: LocalTimeString | null;
  durationMinutes: number | null;
  notes: string | null;
  reminderOffsetMinutes: CalendarEvent["reminderOffsetMinutes"];
  createdAt: string;
  updatedAt: string;
};

const eventSelect = `
  SELECT
    id,
    title,
    kind,
    date,
    start_time AS startTime,
    end_time AS endTime,
    duration_minutes AS durationMinutes,
    notes,
    reminder_offset_minutes AS reminderOffsetMinutes,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM calendar_events
`;

export class SqlCalendarEventStorage implements CalendarEventStorage {
  constructor(private readonly database: SqlExecutor) {}

  async insertEvent(event: CalendarEvent): Promise<void> {
    await this.database.runAsync(
      `
        INSERT INTO calendar_events (
          id,
          title,
          kind,
          date,
          start_time,
          end_time,
          duration_minutes,
          notes,
          reminder_offset_minutes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      event.id,
      event.title,
      event.kind,
      event.date,
      event.startTime,
      event.endTime,
      event.durationMinutes,
      event.notes,
      event.reminderOffsetMinutes,
      event.createdAt,
      event.updatedAt
    );
  }

  async getEventsForDate(date: string): Promise<CalendarEvent[]> {
    const rows = await this.database.getAllAsync<CalendarEventRow>(
      `
        ${eventSelect}
        WHERE date = ?;
      `,
      date
    );

    return rows.map(mapCalendarEventRow);
  }

  async getEventsForRange(startDate: string, endDate: string): Promise<CalendarEvent[]> {
    const rows = await this.database.getAllAsync<CalendarEventRow>(
      `
        ${eventSelect}
        WHERE date >= ?
          AND date <= ?;
      `,
      startDate,
      endDate
    );

    return rows.map(mapCalendarEventRow);
  }

  async getAllEvents(): Promise<CalendarEvent[]> {
    const rows = await this.database.getAllAsync<CalendarEventRow>(eventSelect);

    return rows.map(mapCalendarEventRow);
  }
}

function mapCalendarEventRow(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    durationMinutes: row.durationMinutes,
    notes: row.notes,
    reminderOffsetMinutes: row.reminderOffsetMinutes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

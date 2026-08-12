import {
  CalendarEvent,
  CalendarEventException,
  CalendarEventKind,
  CalendarEventOverride
} from "../types/calendarEvent";
import { LocalDateString, LocalTimeString } from "../types/dateTime";
import { isItemColor, ItemColor } from "../types/itemColor";
import {
  getRelativeReminderOffsets,
  normalizeStoredReminders,
  parseStoredReminders
} from "../notifications/reminders";
import { normalizeRecurrenceRule } from "../features/calendar/recurrenceRules";
import { CalendarEventMutation, CalendarEventStorage } from "./calendarEventStorage";
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
  color: ItemColor;
  reminders: string | null;
  reminderOffsets: string;
  recurrenceRule: string | null;
  createdAt: string;
  updatedAt: string;
};

type CalendarEventExceptionRow = {
  id: string;
  seriesId: string;
  originalDate: LocalDateString;
  status: CalendarEventException["status"];
  overrides: string;
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
    color,
    reminders,
    reminder_offsets AS reminderOffsets,
    recurrence_rule AS recurrenceRule,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM calendar_events
`;

const exceptionSelect = `
  SELECT
    id,
    series_id AS seriesId,
    original_date AS originalDate,
    status,
    overrides,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM calendar_event_exceptions
`;

export class SqlCalendarEventStorage implements CalendarEventStorage {
  constructor(private readonly database: SqlExecutor) {}

  async insertEvent(event: CalendarEvent): Promise<void> {
    await insertEventRow(this.database, event);
  }

  async getEventById(id: string): Promise<CalendarEvent | null> {
    const row = await this.database.getFirstAsync<CalendarEventRow>(
      `${eventSelect} WHERE id = ? LIMIT 1;`,
      id
    );

    return row ? mapCalendarEventRow(row) : null;
  }

  async getEventsForDate(date: string): Promise<CalendarEvent[]> {
    const rows = await this.database.getAllAsync<CalendarEventRow>(
      `${eventSelect} WHERE date = ?;`,
      date
    );

    return rows.map(mapCalendarEventRow);
  }

  async getEventsForRange(startDate: string, endDate: string): Promise<CalendarEvent[]> {
    const rows = await this.database.getAllAsync<CalendarEventRow>(
      `${eventSelect} WHERE date >= ? AND date <= ?;`,
      startDate,
      endDate
    );

    return rows.map(mapCalendarEventRow);
  }

  async getEventSeriesForRange(
    startDate: string,
    endDate: string
  ): Promise<CalendarEvent[]> {
    const rows = await this.database.getAllAsync<CalendarEventRow>(
      `${eventSelect}
       WHERE recurrence_rule IS NOT NULL
          OR (date >= ? AND date <= ?);`,
      startDate,
      endDate
    );

    return rows.map(mapCalendarEventRow);
  }

  async getAllEvents(): Promise<CalendarEvent[]> {
    const rows = await this.database.getAllAsync<CalendarEventRow>(eventSelect);
    return rows.map(mapCalendarEventRow);
  }

  async getExceptionsForSeries(seriesIds: string[]): Promise<CalendarEventException[]> {
    if (seriesIds.length === 0) {
      return [];
    }

    const placeholders = seriesIds.map(() => "?").join(", ");
    const rows = await this.database.getAllAsync<CalendarEventExceptionRow>(
      `${exceptionSelect} WHERE series_id IN (${placeholders});`,
      ...seriesIds
    );

    return rows.map(mapCalendarEventExceptionRow);
  }

  async applyEventMutation(mutation: CalendarEventMutation): Promise<void> {
    await this.database.execAsync("BEGIN IMMEDIATE;");

    try {
      for (const event of mutation.insertEvents ?? []) {
        await insertEventRow(this.database, event);
      }

      for (const event of mutation.updateEvents ?? []) {
        const result = await updateEventRow(this.database, event);

        if (result.changes === 0) {
          throw new Error(`Calendar event ${event.id} could not be updated.`);
        }
      }

      for (const exception of mutation.upsertExceptions ?? []) {
        await upsertExceptionRow(this.database, exception);
      }

      for (const exceptionId of mutation.deleteExceptionIds ?? []) {
        await this.database.runAsync(
          "DELETE FROM calendar_event_exceptions WHERE id = ?;",
          exceptionId
        );
      }

      for (const eventId of mutation.deleteEventIds ?? []) {
        await this.database.runAsync(
          "DELETE FROM calendar_events WHERE id = ?;",
          eventId
        );
      }

      await this.database.execAsync("COMMIT;");
    } catch (error) {
      try {
        await this.database.execAsync("ROLLBACK;");
      } catch {}

      throw error;
    }
  }
}

async function insertEventRow(
  database: SqlExecutor,
  event: CalendarEvent
): Promise<void> {
  await database.runAsync(
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
        color,
        reminder_offsets,
        reminders,
        recurrence_rule,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    event.id,
    event.title,
    event.kind,
    event.date,
    event.startTime,
    event.endTime,
    event.durationMinutes,
    event.notes,
    event.color,
    JSON.stringify(getRelativeReminderOffsets(event.reminders)),
    JSON.stringify(event.reminders),
    event.recurrence ? JSON.stringify(event.recurrence) : null,
    event.createdAt,
    event.updatedAt
  );
}

function updateEventRow(database: SqlExecutor, event: CalendarEvent) {
  return database.runAsync(
    `
      UPDATE calendar_events
      SET title = ?,
          kind = ?,
          date = ?,
          start_time = ?,
          end_time = ?,
          duration_minutes = ?,
          notes = ?,
          color = ?,
          reminder_offsets = ?,
          reminders = ?,
          recurrence_rule = ?,
          updated_at = ?
      WHERE id = ?;
    `,
    event.title,
    event.kind,
    event.date,
    event.startTime,
    event.endTime,
    event.durationMinutes,
    event.notes,
    event.color,
    JSON.stringify(getRelativeReminderOffsets(event.reminders)),
    JSON.stringify(event.reminders),
    event.recurrence ? JSON.stringify(event.recurrence) : null,
    event.updatedAt,
    event.id
  );
}

function upsertExceptionRow(
  database: SqlExecutor,
  exception: CalendarEventException
): Promise<unknown> {
  return database.runAsync(
    `
      INSERT INTO calendar_event_exceptions (
        id,
        series_id,
        original_date,
        status,
        overrides,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(series_id, original_date) DO UPDATE SET
        status = excluded.status,
        overrides = excluded.overrides,
        updated_at = excluded.updated_at;
    `,
    exception.id,
    exception.seriesId,
    exception.originalDate,
    exception.status,
    JSON.stringify(exception.overrides),
    exception.createdAt,
    exception.updatedAt
  );
}

function mapCalendarEventRow(row: CalendarEventRow): CalendarEvent {
  const reminders = parseStoredReminders(row.reminders, row.reminderOffsets);
  let recurrence: CalendarEvent["recurrence"] = null;

  if (row.recurrenceRule) {
    recurrence = normalizeRecurrenceRule(JSON.parse(row.recurrenceRule), row.date);
  }

  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    durationMinutes: row.durationMinutes,
    notes: row.notes,
    color: isItemColor(row.color) ? row.color : "neutral",
    reminders,
    reminderOffsets: getRelativeReminderOffsets(reminders),
    recurrence,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapCalendarEventExceptionRow(
  row: CalendarEventExceptionRow
): CalendarEventException {
  return {
    id: row.id,
    seriesId: row.seriesId,
    originalDate: row.originalDate,
    status: row.status,
    overrides: parseStoredOverrides(row.overrides),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function parseStoredOverrides(value: string): CalendarEventOverride {
  const parsed = JSON.parse(value) as CalendarEventOverride;

  if (parsed.reminders) {
    parsed.reminders = normalizeStoredReminders(parsed.reminders, []);
  }

  return parsed;
}

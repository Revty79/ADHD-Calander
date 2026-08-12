import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { initializeDatabase } from "../src/database/database";
import { CalendarEventValidationError } from "../src/database/repositories/calendarEventErrors";
import { CalendarEventRepository } from "../src/database/repositories/calendarEventRepository";
import { SqlCalendarEventStorage } from "../src/database/sqlCalendarEventStorage";
import { createSqlJsDatabase } from "./helpers/sqlJsDatabase";

async function createRepository() {
  const database = await createSqlJsDatabase();
  await initializeDatabase(database);
  let id = 0;
  const repository = new CalendarEventRepository(
    new SqlCalendarEventStorage(database),
    () => `event-${++id}`,
    () => new Date("2026-08-06T15:00:00.000Z")
  );

  return { database, repository };
}

describe("calendar event repository", () => {
  it("creates a normalized fixed event", async () => {
    const { repository } = await createRepository();
    const event = await repository.createEvent({
      title: "  Dentist  ",
      date: "2026-08-06",
      startTime: "09:30",
      endTime: "10:15",
      notes: "  Bring insurance card  "
    });

    assert.equal(event.id, "event-1");
    assert.equal(event.title, "Dentist");
    assert.equal(event.kind, "fixed");
    assert.equal(event.date, "2026-08-06");
    assert.equal(event.startTime, "09:30");
    assert.equal(event.endTime, "10:15");
    assert.equal(event.durationMinutes, null);
    assert.equal(event.notes, "Bring insurance card");
  });

  it("retrieves one local date in chronological order", async () => {
    const { repository } = await createRepository();
    await repository.createEvent({
      title: "Afternoon appointment",
      date: "2026-08-06",
      startTime: "14:00",
      durationMinutes: 30
    });
    await repository.createEvent({
      title: "Morning appointment",
      date: "2026-08-06",
      startTime: "08:15",
      durationMinutes: 45
    });
    await repository.createEvent({
      title: "Another day",
      date: "2026-08-07",
      startTime: "08:00"
    });

    const events = await repository.getEventsForDate("2026-08-06");

    assert.deepEqual(
      events.map((event) => event.title),
      ["Morning appointment", "Afternoon appointment"]
    );
  });

  it("persists events through database reinitialization", async () => {
    const { database, repository } = await createRepository();
    const createdEvent = await repository.createEvent({
      title: "Therapy appointment",
      date: "2026-08-06",
      startTime: "16:00",
      durationMinutes: 50
    });

    const restoredDatabase = await createSqlJsDatabase(database.exportData());
    await initializeDatabase(restoredDatabase);
    const restoredRepository = new CalendarEventRepository(
      new SqlCalendarEventStorage(restoredDatabase)
    );

    assert.deepEqual(await restoredRepository.getEventsForDate("2026-08-06"), [
      {
        ...createdEvent,
        seriesId: createdEvent.id,
        originalDate: createdEvent.date,
        isRecurring: false
      }
    ]);
  });

  it("rejects blank titles and invalid times", async () => {
    const { repository } = await createRepository();

    await assert.rejects(
      () =>
        repository.createEvent({
          title: "   ",
          date: "2026-08-06",
          startTime: "09:00"
        }),
      (error) => {
        assert.ok(error instanceof CalendarEventValidationError);
        assert.equal(error.field, "title");
        return true;
      }
    );

    await assert.rejects(
      () =>
        repository.createEvent({
          title: "Appointment",
          date: "2026-08-06",
          startTime: "25:00"
        }),
      (error) => {
        assert.ok(error instanceof CalendarEventValidationError);
        assert.equal(error.field, "startTime");
        return true;
      }
    );

    await assert.rejects(
      () =>
        repository.createEvent({
          title: "Appointment",
          date: "2026-08-06",
          startTime: "10:00",
          endTime: "09:45"
        }),
      (error) => {
        assert.ok(error instanceof CalendarEventValidationError);
        assert.equal(error.field, "endTime");
        return true;
      }
    );
  });

  it("rejects an end time combined with duration", async () => {
    const { repository } = await createRepository();

    await assert.rejects(
      () =>
        repository.createEvent({
          title: "Appointment",
          date: "2026-08-06",
          startTime: "10:00",
          endTime: "10:30",
          durationMinutes: 30
        }),
      (error) => {
        assert.ok(error instanceof CalendarEventValidationError);
        assert.equal(error.field, "durationMinutes");
        return true;
      }
    );
  });
});

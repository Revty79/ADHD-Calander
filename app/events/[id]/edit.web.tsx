import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { useCalendarEventRepository } from "../../../src/database/DatabaseProvider";
import { EventEditorForm } from "../../../src/features/calendar/components/EventEditorForm";
import {
  CalendarEvent,
  CalendarEventEditScope,
  CalendarEventOccurrence,
  CreateCalendarEventInput
} from "../../../src/types/calendarEvent";

export default function WebEditEventScreen() {
  const params = useLocalSearchParams<{ id: string; originalDate?: string }>();
  const router = useRouter();
  const repository = useCalendarEventRepository();
  const [series, setSeries] = useState<CalendarEvent | null>(null);
  const [occurrence, setOccurrence] = useState<CalendarEventOccurrence | null>(null);
  const [scope, setScope] = useState<CalendarEventEditScope | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const loadedSeries = await repository.getEventSeries(params.id);
        const loadedOccurrence = await repository.getEventOccurrence(
          params.id,
          params.originalDate ?? loadedSeries.date
        );
        if (active) {
          setSeries(loadedSeries);
          setOccurrence(loadedOccurrence);
          setScope(loadedSeries.recurrence ? null : "all");
        }
      } catch {
        if (active) setErrorMessage("The event could not be loaded. Please try again.");
      }
    })();
    return () => {
      active = false;
    };
  }, [params.id, params.originalDate, repository]);

  if (errorMessage)
    return (
      <main className="web-form-shell">
        <div className="web-error-notice" role="alert">
          <p>{errorMessage}</p>
        </div>
      </main>
    );
  if (!series || !occurrence)
    return (
      <main className="web-form-shell">
        <p className="web-loading-state">Loading event...</p>
      </main>
    );
  const activeSeries = series;
  const activeOccurrence = occurrence;
  if (activeSeries.recurrence && !scope)
    return (
      <main className="web-form-shell">
        <div className="web-form-page">
          <header className="web-form-header">
            <p className="web-eyebrow">Recurring event</p>
            <h1>Which events should change?</h1>
            <p>Choose the part of this series you want to edit or remove.</p>
          </header>
          <div className="web-scope-grid">
            {scopeOptions.map((option) => (
              <button
                className="web-secondary-button"
                key={option.value}
                onClick={() => setScope(option.value)}
                type="button"
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    );

  async function save(input: CreateCalendarEventInput) {
    const result = await repository.updateEvent(
      activeSeries.id,
      activeOccurrence.originalDate,
      scope!,
      input
    );
    router.replace({ pathname: "/(tabs)/calendar", params: { date: result.date } });
  }
  async function remove() {
    if (!globalThis.confirm(`Remove event? ${scopeLabels[scope!]}`)) return;
    await repository.deleteEvent(activeSeries.id, activeOccurrence.originalDate, scope!);
    router.replace({
      pathname: "/(tabs)/calendar",
      params: { date: activeOccurrence.date }
    });
  }

  return (
    <main className="web-form-shell">
      <div className="web-form-page">
        <Link
          className="web-back-link"
          href={{ pathname: "/calendar", params: { date: activeOccurrence.date } }}
        >
          Back to Calendar
        </Link>
        <header className="web-form-header">
          <p className="web-eyebrow">
            {activeSeries.recurrence ? scopeLabels[scope!] : "Single event"}
          </p>
          <h1>Edit event</h1>
          {activeSeries.recurrence ? (
            <button
              className="web-text-button"
              onClick={() => setScope(null)}
              type="button"
            >
              Change edit scope
            </button>
          ) : null}
        </header>
        <EventEditorForm
          allowRecurrenceEdit={scope !== "this"}
          initialDate={activeOccurrence.date}
          initialEvent={activeOccurrence}
          initialRecurrence={activeSeries.recurrence}
          onDelete={remove}
          onSubmit={save}
          submitLabel="Save changes"
        />
      </div>
    </main>
  );
}

const scopeOptions: {
  value: CalendarEventEditScope;
  label: string;
  description: string;
}[] = [
  { value: "this", label: "This event", description: "Only this occurrence changes." },
  {
    value: "future",
    label: "This and future events",
    description: "Past occurrences stay factual; a new future series begins here."
  },
  {
    value: "all",
    label: "All events",
    description: "Update the recurring series as a whole."
  }
];
const scopeLabels: Record<CalendarEventEditScope, string> = {
  this: "Changing this occurrence only",
  future: "Changing this and future occurrences",
  all: "Changing the whole series"
};

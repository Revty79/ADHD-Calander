import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { FormEvent, useMemo, useState } from "react";

import { useCalendarEventRepository } from "../../src/database/DatabaseProvider";
import { CalendarEventValidationError } from "../../src/database/repositories/calendarEventErrors";
import { getLocalDateString, normalizeLocalDateInput } from "../../src/utils/dates";

type FieldErrors = Partial<Record<CalendarEventValidationError["field"], string>>;
type TimingMethod = "endTime" | "duration";

const durationOptions = [15, 30, 45, 60, 90, 120] as const;

export default function WebNewEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const eventRepository = useCalendarEventRepository();
  const initialDate = useMemo(
    () => normalizeLocalDateInput(params.date ?? "") ?? getLocalDateString(),
    [params.date]
  );
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>(initialDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timingMethod, setTimingMethod] = useState<TimingMethod>("duration");
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await eventRepository.createEvent({
        title,
        date,
        startTime,
        endTime: timingMethod === "endTime" ? endTime : null,
        durationMinutes: timingMethod === "duration" ? durationMinutes : null,
        notes
      });

      router.replace({ pathname: "/(tabs)/calendar", params: { date } });
    } catch (error) {
      if (error instanceof CalendarEventValidationError) {
        setFieldErrors({ [error.field]: error.message });
      } else {
        setErrorMessage("The event could not be saved. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="web-form-shell">
      <div className="web-form-page">
        <Link
          className="web-back-link"
          href={{ pathname: "/calendar", params: { date: initialDate } }}
        >
          Back to Calendar
        </Link>

        <header className="web-form-header">
          <p className="web-eyebrow">Fixed commitment</p>
          <h1>New event</h1>
          <p>Events stay fixed. Use a task for work that may remain flexible.</p>
        </header>

        <form className="web-task-form" noValidate onSubmit={saveEvent}>
          <FormField error={fieldErrors.title} id="event-title" label="Title">
            <input
              autoFocus
              id="event-title"
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder="Event title"
              required
              type="text"
              value={title}
            />
          </FormField>

          <div className="web-form-row">
            <FormField error={fieldErrors.date} id="event-date" label="Date">
              <input
                id="event-date"
                onChange={(event) => setDate(event.currentTarget.value)}
                required
                type="date"
                value={date}
              />
            </FormField>
            <FormField
              error={fieldErrors.startTime}
              id="event-start-time"
              label="Start time"
            >
              <input
                id="event-start-time"
                onChange={(event) => setStartTime(event.currentTarget.value)}
                required
                type="time"
                value={startTime}
              />
            </FormField>
          </div>

          <fieldset className="web-choice-fieldset">
            <legend>Event length</legend>
            <div className="web-choice-options">
              <label>
                <input
                  checked={timingMethod === "endTime"}
                  name="event-timing-method"
                  onChange={() => setTimingMethod("endTime")}
                  type="radio"
                />
                <span>End time</span>
              </label>
              <label>
                <input
                  checked={timingMethod === "duration"}
                  name="event-timing-method"
                  onChange={() => setTimingMethod("duration")}
                  type="radio"
                />
                <span>Duration</span>
              </label>
            </div>
          </fieldset>

          {timingMethod === "endTime" ? (
            <FormField error={fieldErrors.endTime} id="event-end-time" label="End time">
              <input
                id="event-end-time"
                onChange={(event) => setEndTime(event.currentTarget.value)}
                type="time"
                value={endTime}
              />
            </FormField>
          ) : (
            <fieldset className="web-choice-fieldset">
              <legend>Duration</legend>
              <div className="web-choice-options">
                {durationOptions.map((duration) => (
                  <label key={duration}>
                    <input
                      checked={durationMinutes === duration}
                      name="event-duration"
                      onChange={() => setDurationMinutes(duration)}
                      type="radio"
                      value={duration}
                    />
                    <span>{duration} min</span>
                  </label>
                ))}
              </div>
              {fieldErrors.durationMinutes ? (
                <p className="web-validation-message" role="alert">
                  {fieldErrors.durationMinutes}
                </p>
              ) : null}
            </fieldset>
          )}

          <FormField id="event-notes" label="Notes" optional>
            <textarea
              id="event-notes"
              onChange={(event) => setNotes(event.currentTarget.value)}
              placeholder="Helpful details"
              rows={4}
              value={notes}
            />
          </FormField>

          <section className="web-form-info" aria-labelledby="event-reminders-title">
            <strong id="event-reminders-title">Reminders</strong>
            <p>
              Browser notification delivery is not supported. Add multiple event reminders
              in the Android app.
            </p>
          </section>

          {errorMessage ? (
            <div className="web-error-notice" role="alert">
              <p>{errorMessage}</p>
            </div>
          ) : null}

          <div className="web-form-actions">
            <button className="web-primary-button" disabled={isSaving} type="submit">
              {isSaving ? "Saving event..." : "Save event"}
            </button>
            <Link
              className="web-cancel-link"
              href={{ pathname: "/calendar", params: { date: initialDate } }}
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

function FormField({
  children,
  error,
  id,
  label,
  optional = false
}: {
  children: React.ReactNode;
  error?: string | undefined;
  id: string;
  label: string;
  optional?: boolean;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="web-form-group">
      <label htmlFor={id}>
        {label} {optional ? <span>Optional</span> : null}
      </label>
      <div
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
      >
        {children}
      </div>
      {error ? (
        <p className="web-validation-message" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

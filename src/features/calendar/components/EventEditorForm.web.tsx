import { FormEvent, useState } from "react";

import { ItemColorPicker } from "../../../components/ItemColorPicker";
import { CalendarEventValidationError } from "../../../database/repositories/calendarEventErrors";
import {
  CalendarEventOccurrence,
  CalendarRecurrenceRule,
  CreateCalendarEventInput
} from "../../../types/calendarEvent";
import { ItemColor } from "../../../types/itemColor";
import { Reminder } from "../../../types/reminder";
import { ReminderEditor } from "../../reminders/components/ReminderEditor";
import { RecurrenceEditor } from "./RecurrenceEditor";

type FieldErrors = Partial<Record<CalendarEventValidationError["field"], string>>;

export function EventEditorForm({
  allowRecurrenceEdit = true,
  initialDate,
  initialEvent,
  initialRecurrence = null,
  onDelete,
  onSubmit,
  submitLabel
}: {
  allowRecurrenceEdit?: boolean;
  initialDate: string;
  initialEvent?: CalendarEventOccurrence;
  initialRecurrence?: CalendarRecurrenceRule | null;
  onDelete?(): Promise<void>;
  onSubmit(input: CreateCalendarEventInput): Promise<void>;
  submitLabel: string;
}) {
  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [date, setDate] = useState(initialEvent?.date ?? initialDate);
  const [startTime, setStartTime] = useState(initialEvent?.startTime ?? "");
  const [endTime, setEndTime] = useState(initialEvent?.endTime ?? "");
  const [durationMinutes, setDurationMinutes] = useState(
    initialEvent?.durationMinutes ? String(initialEvent.durationMinutes) : ""
  );
  const [recurrence, setRecurrence] = useState<CalendarRecurrenceRule | null>(
    initialRecurrence
  );
  const [color, setColor] = useState<ItemColor>(initialEvent?.color ?? "neutral");
  const [reminders, setReminders] = useState<Reminder[]>(initialEvent?.reminders ?? []);
  const [notes, setNotes] = useState(initialEvent?.notes ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setErrorMessage(null);
    setIsSaving(true);
    try {
      await onSubmit({
        title,
        date,
        startTime,
        endTime,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        recurrence,
        color,
        reminders,
        notes
      });
    } catch (error) {
      if (error instanceof CalendarEventValidationError)
        setFieldErrors({ [error.field]: error.message });
      else setErrorMessage("The event could not be saved. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function remove() {
    if (!onDelete) return;
    setErrorMessage(null);
    setIsDeleting(true);
    try {
      await onDelete();
    } catch {
      setErrorMessage("The event could not be removed. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <form className="web-task-form" noValidate onSubmit={save}>
      <Field error={fieldErrors.title} id="event-title" label="Title">
        <input
          autoFocus
          id="event-title"
          onChange={(event) => setTitle(event.currentTarget.value)}
          placeholder="Event title"
          type="text"
          value={title}
        />
      </Field>
      <div className="web-form-row">
        <Field error={fieldErrors.date} id="event-date" label="Date">
          <input
            id="event-date"
            onChange={(event) => setDate(event.currentTarget.value)}
            type="date"
            value={date}
          />
        </Field>
        <Field error={fieldErrors.startTime} id="event-start" label="Start time">
          <input
            id="event-start"
            onChange={(event) => setStartTime(event.currentTarget.value)}
            type="time"
            value={startTime}
          />
        </Field>
      </div>
      <div className="web-form-row">
        <Field error={fieldErrors.endTime} id="event-end" label="End time" optional>
          <input
            id="event-end"
            onChange={(event) => {
              setEndTime(event.currentTarget.value);
              if (event.currentTarget.value) setDurationMinutes("");
            }}
            type="time"
            value={endTime}
          />
        </Field>
        <Field
          error={fieldErrors.durationMinutes}
          id="event-duration"
          label="Duration in minutes"
          optional
        >
          <input
            id="event-duration"
            min="1"
            onChange={(event) => {
              setDurationMinutes(event.currentTarget.value);
              if (event.currentTarget.value) setEndTime("");
            }}
            type="number"
            value={durationMinutes}
          />
        </Field>
      </div>
      <p className="web-form-hint">Use an end time or a duration, not both.</p>
      <RecurrenceEditor
        date={date as CalendarEventOccurrence["date"]}
        disabled={!allowRecurrenceEdit}
        error={fieldErrors.recurrence}
        onChange={setRecurrence}
        value={recurrence}
      />
      <ItemColorPicker onChange={setColor} value={color} />
      <ReminderEditor
        allowRelative
        deliveryMessage="Notification delivery is unavailable in the web build. Reminder choices still stay saved."
        error={fieldErrors.reminders ?? fieldErrors.reminderOffsets}
        onChange={setReminders}
        value={reminders}
      />
      <Field id="event-notes" label="Notes" optional>
        <textarea
          id="event-notes"
          onChange={(event) => setNotes(event.currentTarget.value)}
          placeholder="Helpful details"
          rows={4}
          value={notes}
        />
      </Field>
      {errorMessage ? (
        <div className="web-error-notice" role="alert">
          <p>{errorMessage}</p>
        </div>
      ) : null}
      <div className="web-form-actions">
        <button
          className="web-primary-button"
          disabled={isSaving || isDeleting}
          type="submit"
        >
          {isSaving ? "Saving event..." : submitLabel}
        </button>
        {onDelete ? (
          <button
            className="web-secondary-button"
            disabled={isSaving || isDeleting}
            onClick={remove}
            type="button"
          >
            {isDeleting ? "Removing event..." : "Remove event"}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
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
  return (
    <div className="web-form-group">
      <label htmlFor={id}>
        {label} {optional ? <span>Optional</span> : null}
      </label>
      <div
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
      >
        {children}
      </div>
      {error ? (
        <p className="web-validation-message" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

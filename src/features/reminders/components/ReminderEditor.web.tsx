import { useState } from "react";

import {
  formatReminder,
  formatReminderOffset
} from "../../../notifications/reminderRules";
import { getReminderKey } from "../../../notifications/reminders";
import {
  maxRemindersPerItem,
  Reminder,
  reminderSelectionOptions
} from "../../../types/reminder";
import { getLocalDateString } from "../../../utils/dates";
import {
  removeReminder,
  toggleRelativeReminder,
  upsertAbsoluteReminder
} from "../reminderEditorModel";

type Props = {
  allowRelative: boolean;
  deliveryMessage: string;
  error?: string | undefined;
  onChange(value: Reminder[]): void;
  value: Reminder[];
};

export function ReminderEditor({
  allowRelative,
  deliveryMessage,
  error,
  onChange,
  value
}: Props) {
  const [customDate, setCustomDate] = useState<string>(() => getLocalDateString());
  const [customTime, setCustomTime] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function saveCustomReminder() {
    setLocalError(null);

    try {
      onChange(upsertAbsoluteReminder(value, editingKey, customDate, customTime));
      resetCustomEditor();
    } catch (saveError) {
      setLocalError(
        saveError instanceof Error
          ? saveError.message
          : "Choose a valid reminder date and time."
      );
    }
  }

  function editReminder(reminder: Reminder) {
    if (reminder.kind !== "absolute") {
      return;
    }

    setEditingKey(getReminderKey(reminder));
    setCustomDate(reminder.date);
    setCustomTime(reminder.time);
    setLocalError(null);
  }

  function resetCustomEditor() {
    setEditingKey(null);
    setCustomDate(getLocalDateString());
    setCustomTime("");
    setLocalError(null);
  }

  function removeSavedReminder(reminder: Reminder) {
    onChange(removeReminder(value, reminder));

    if (editingKey === getReminderKey(reminder)) {
      resetCustomEditor();
    }
  }

  const atLimit = value.length >= maxRemindersPerItem && editingKey === null;

  return (
    <section className="web-reminder-editor" aria-labelledby="reminder-editor-title">
      <div className="web-form-info">
        <strong id="reminder-editor-title">Reminders</strong>
        <p>
          Add up to {maxRemindersPerItem}. A reminder does not change where a task or
          event is placed.
        </p>
        <p>{deliveryMessage}</p>
      </div>

      {allowRelative ? (
        <fieldset className="web-choice-fieldset">
          <legend>Relative to the scheduled time</legend>
          <div className="web-choice-options">
            {reminderSelectionOptions.map((offsetMinutes) => {
              const reminder: Reminder = { kind: "relative", offsetMinutes };
              const checked = value.some(
                (candidate) => getReminderKey(candidate) === getReminderKey(reminder)
              );
              const disabled = value.length >= maxRemindersPerItem && !checked;

              return (
                <label key={offsetMinutes}>
                  <input
                    checked={checked}
                    disabled={disabled}
                    onChange={() =>
                      onChange(toggleRelativeReminder(value, offsetMinutes))
                    }
                    type="checkbox"
                  />
                  <span>{formatReminderOffset(offsetMinutes)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {value.length > 0 ? (
        <div className="web-reminder-list">
          <strong>Saved reminders</strong>
          {value.map((reminder) => (
            <div className="web-reminder-row" key={getReminderKey(reminder)}>
              <span>{formatReminder(reminder)}</span>
              <div className="web-reminder-actions">
                {reminder.kind === "absolute" ? (
                  <button
                    className="web-text-button"
                    onClick={() => editReminder(reminder)}
                    type="button"
                  >
                    Edit
                  </button>
                ) : null}
                <button
                  className="web-text-button"
                  onClick={() => removeSavedReminder(reminder)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="web-form-row">
        <div className="web-form-group">
          <label htmlFor="custom-reminder-date">Custom reminder date</label>
          <input
            id="custom-reminder-date"
            onChange={(event) => setCustomDate(event.currentTarget.value)}
            type="date"
            value={customDate}
          />
        </div>
        <div className="web-form-group">
          <label htmlFor="custom-reminder-time">Custom reminder time</label>
          <input
            id="custom-reminder-time"
            onChange={(event) => setCustomTime(event.currentTarget.value)}
            type="time"
            value={customTime}
          />
        </div>
      </div>

      <div className="web-form-actions">
        <button
          className="web-secondary-button"
          disabled={atLimit}
          onClick={saveCustomReminder}
          type="button"
        >
          {editingKey ? "Save reminder" : "Add reminder"}
        </button>
        {editingKey ? (
          <button className="web-text-button" onClick={resetCustomEditor} type="button">
            Cancel edit
          </button>
        ) : null}
      </div>

      {atLimit ? <small>Remove a reminder before adding another.</small> : null}
      {localError || error ? (
        <p className="web-validation-message" role="alert">
          {localError ?? error}
        </p>
      ) : null}
    </section>
  );
}

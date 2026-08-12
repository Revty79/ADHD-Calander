import { useEffect, useState } from "react";

import {
  CalendarRecurrenceRule,
  CalendarWeekday,
  RecurrenceEnd
} from "../../../types/calendarEvent";
import { LocalDateString } from "../../../types/dateTime";
import { getOrdinalWeekday, getWeekday } from "../recurrence";
import {
  buildPresetRecurrence,
  getOrdinalLabel,
  getRecurrencePreset,
  recurrencePresets,
  RecurrencePreset,
  weekdayOptions
} from "../recurrenceRules";

type Props = {
  date: LocalDateString;
  disabled?: boolean;
  error?: string | undefined;
  onChange(value: CalendarRecurrenceRule | null): void;
  value: CalendarRecurrenceRule | null;
};

export function RecurrenceEditor({
  date,
  disabled = false,
  error,
  onChange,
  value
}: Props) {
  const [preset, setPreset] = useState<RecurrencePreset>(() =>
    getRecurrencePreset(value, date)
  );

  useEffect(() => {
    if (!disabled && preset !== "none" && preset !== "custom") {
      onChange(buildPresetRecurrence(preset, date));
    }
  }, [date, disabled, onChange, preset]);

  function choosePreset(nextPreset: RecurrencePreset) {
    setPreset(nextPreset);
    if (nextPreset === "none") onChange(null);
    else if (nextPreset === "custom")
      onChange(value ?? { frequency: "daily", interval: 1, end: { kind: "never" } });
    else onChange(buildPresetRecurrence(nextPreset, date));
  }

  return (
    <fieldset className="web-choice-fieldset">
      <legend>Repeat</legend>
      {disabled ? (
        <p className="web-form-hint">This occurrence keeps the series repeat pattern.</p>
      ) : (
        <div className="web-choice-grid">
          {recurrencePresets.map((option) => (
            <label key={option}>
              <input
                checked={preset === option}
                name="event-repeat"
                onChange={() => choosePreset(option)}
                type="radio"
                value={option}
              />
              <span>{getPresetLabel(option)}</span>
            </label>
          ))}
        </div>
      )}
      {!disabled && preset === "custom" && value ? (
        <CustomEditor date={date} onChange={onChange} value={value} />
      ) : null}
      {error ? (
        <p className="web-validation-message" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function CustomEditor({
  date,
  onChange,
  value
}: {
  date: LocalDateString;
  onChange(value: CalendarRecurrenceRule): void;
  value: CalendarRecurrenceRule;
}) {
  function changeFrequency(frequency: CalendarRecurrenceRule["frequency"]) {
    const common = { interval: value.interval, end: value.end };
    if (frequency === "daily" || frequency === "yearly")
      onChange({ frequency, ...common });
    else if (frequency === "weekly")
      onChange({ frequency, weekdays: [getWeekday(date)], ...common });
    else onChange({ frequency, monthlyPattern: { kind: "same_date" }, ...common });
  }

  return (
    <div className="web-recurrence-advanced">
      <h3>Custom repeat</h3>
      <div className="web-form-row">
        <label className="web-inline-field">
          Every{" "}
          <input
            aria-label="Repeat interval"
            min="1"
            max="999"
            onChange={(event) =>
              onChange({ ...value, interval: Number(event.currentTarget.value) || 1 })
            }
            type="number"
            value={value.interval}
          />
        </label>
        <label className="web-inline-field">
          Frequency
          <select
            onChange={(event) =>
              changeFrequency(
                event.currentTarget.value as CalendarRecurrenceRule["frequency"]
              )
            }
            value={value.frequency}
          >
            <option value="daily">Days</option>
            <option value="weekly">Weeks</option>
            <option value="monthly">Months</option>
            <option value="yearly">Years</option>
          </select>
        </label>
      </div>
      {value.frequency === "weekly" ? (
        <Weekdays
          onChange={(weekdays) => onChange({ ...value, weekdays })}
          value={value.weekdays}
        />
      ) : null}
      {value.frequency === "monthly" ? (
        <Monthly
          date={date}
          onChange={(monthlyPattern) => onChange({ ...value, monthlyPattern })}
          value={value.monthlyPattern}
        />
      ) : null}
      <Ends
        anchorDate={date}
        onChange={(end) => onChange({ ...value, end })}
        value={value.end}
      />
      {value.frequency === "yearly" && date.slice(5) === "02-29" ? (
        <p className="web-form-hint">Leap-day events occur only in leap years.</p>
      ) : null}
    </div>
  );
}

function Weekdays({
  onChange,
  value
}: {
  onChange(value: CalendarWeekday[]): void;
  value: CalendarWeekday[];
}) {
  return (
    <fieldset className="web-choice-fieldset">
      <legend>On weekdays</legend>
      <div className="web-choice-grid">
        {weekdayOptions.map((option) => (
          <label key={option.value}>
            <input
              checked={value.includes(option.value)}
              onChange={() =>
                onChange(
                  value.includes(option.value)
                    ? value.filter((day) => day !== option.value)
                    : [...value, option.value].sort()
                )
              }
              type="checkbox"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Monthly({
  date,
  onChange,
  value
}: {
  date: LocalDateString;
  onChange(
    value: Extract<CalendarRecurrenceRule, { frequency: "monthly" }>["monthlyPattern"]
  ): void;
  value: Extract<CalendarRecurrenceRule, { frequency: "monthly" }>["monthlyPattern"];
}) {
  const pattern = getOrdinalWeekday(date);
  return (
    <fieldset className="web-choice-fieldset">
      <legend>Monthly pattern</legend>
      <div className="web-choice-grid">
        <label>
          <input
            checked={value.kind === "same_date"}
            name="monthly-pattern"
            onChange={() => onChange({ kind: "same_date" })}
            type="radio"
          />
          <span>Same date ({Number(date.slice(8))})</span>
        </label>
        <label>
          <input
            checked={value.kind === "ordinal_weekday"}
            name="monthly-pattern"
            onChange={() => onChange({ kind: "ordinal_weekday", ...pattern })}
            type="radio"
          />
          <span>
            {getOrdinalLabel(pattern.ordinal)} {weekdayOptions[pattern.weekday]?.label}
          </span>
        </label>
      </div>
    </fieldset>
  );
}

function Ends({
  anchorDate,
  onChange,
  value
}: {
  anchorDate: LocalDateString;
  onChange(value: RecurrenceEnd): void;
  value: RecurrenceEnd;
}) {
  return (
    <fieldset className="web-choice-fieldset">
      <legend>Ends</legend>
      <div className="web-choice-grid">
        <label>
          <input
            checked={value.kind === "never"}
            name="repeat-end"
            onChange={() => onChange({ kind: "never" })}
            type="radio"
          />
          <span>Never</span>
        </label>
        <label>
          <input
            checked={value.kind === "on_date"}
            name="repeat-end"
            onChange={() => onChange({ kind: "on_date", date: anchorDate })}
            type="radio"
          />
          <span>On date</span>
        </label>
        <label>
          <input
            checked={value.kind === "after_count"}
            name="repeat-end"
            onChange={() => onChange({ kind: "after_count", count: 10 })}
            type="radio"
          />
          <span>After count</span>
        </label>
      </div>
      {value.kind === "on_date" ? (
        <input
          aria-label="Repeat end date"
          onChange={(event) =>
            onChange({
              kind: "on_date",
              date: event.currentTarget.value as LocalDateString
            })
          }
          type="date"
          value={value.date}
        />
      ) : null}
      {value.kind === "after_count" ? (
        <input
          aria-label="Number of occurrences"
          max="9999"
          min="1"
          onChange={(event) =>
            onChange({
              kind: "after_count",
              count: Number(event.currentTarget.value) || 1
            })
          }
          type="number"
          value={value.count}
        />
      ) : null}
    </fieldset>
  );
}

function getPresetLabel(preset: RecurrencePreset): string {
  return (
    {
      none: "Doesn't repeat",
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      yearly: "Yearly",
      custom: "Custom"
    } as const
  )[preset];
}

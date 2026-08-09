import { FormEvent, useRef, useState } from "react";

import { TaskValidationError } from "../../../database/repositories/errors";
import {
  formatReminderOffset,
  formatReminderOffsets
} from "../../../notifications/reminderRules";
import {
  maxRemindersPerItem,
  ReminderOffsetMinutes,
  ReminderPermissionStatus,
  reminderSelectionOptions
} from "../../../types/reminder";
import {
  CreateTaskInput,
  getTaskPlanningState,
  PlannedTimePreference,
  Task,
  TaskImportance,
  TaskPlanningState
} from "../../../types/task";
import { useReminderSettings } from "../../settings/hooks/useReminderSettings";
import {
  getDeadlineQuickChoices,
  getPlannedDateQuickChoices,
  TaskDateQuickChoice
} from "../taskDateChoices";
import { plannedTimePreferenceOptions } from "../plannedTimePreferences";

type FieldErrors = Partial<Record<TaskValidationError["field"], string>>;

type Props = {
  initialDate?: string;
  initialTask?: Task;
  onSubmit(input: CreateTaskInput): Promise<void>;
  submitLabel: string;
};

const durationOptions = [null, 10, 15, 30, 45, 60, 90, 120] as const;
const importanceOptions: { label: string; value: TaskImportance }[] = [
  { label: "Low", value: "low" },
  { label: "Normal", value: "normal" },
  { label: "Important", value: "important" }
];
const planningOptions: { label: string; value: TaskPlanningState }[] = [
  { label: "Flexible", value: "flexible" },
  { label: "Planned", value: "planned" },
  { label: "Scheduled", value: "scheduled" }
];

export function TaskEditorForm({
  initialDate = "",
  initialTask,
  onSubmit,
  submitLabel
}: Props) {
  const reminderSettings = useReminderSettings();
  const [title, setTitle] = useState(initialTask?.title ?? "");
  const [description, setDescription] = useState(initialTask?.description ?? "");
  const [importance, setImportance] = useState<TaskImportance>(
    initialTask?.importance ?? "normal"
  );
  const [planningState, setPlanningState] = useState<TaskPlanningState>(
    initialTask ? getTaskPlanningState(initialTask) : initialDate ? "planned" : "flexible"
  );
  const [scheduledDate, setScheduledDate] = useState(
    initialTask?.scheduledDate ?? initialDate
  );
  const [scheduledTime, setScheduledTime] = useState(initialTask?.scheduledTime ?? "");
  const [plannedTimePreference, setPlannedTimePreference] =
    useState<PlannedTimePreference>(initialTask?.plannedTimePreference ?? "anytime");
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState<number | null>(
    initialTask?.estimatedDurationMinutes ?? null
  );
  const [deadlineDate, setDeadlineDate] = useState(initialTask?.deadlineDate ?? "");
  const [reminderOffsets, setReminderOffsets] = useState<ReminderOffsetMinutes[]>(
    initialTask?.reminderOffsets ?? []
  );
  const [referenceDate] = useState(() => new Date());
  const deadlineInput = useRef<HTMLInputElement>(null);
  const [detailsOpen, setDetailsOpen] = useState(Boolean(initialTask || initialDate));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function choosePlanningState(nextState: TaskPlanningState) {
    setPlanningState(nextState);

    if (nextState === "flexible") {
      setScheduledDate("");
      setScheduledTime("");
    } else if (nextState === "planned") {
      setScheduledTime("");
    } else if (!scheduledDate) {
      setScheduledDate(getPlannedDateQuickChoices(referenceDate)[0]?.value ?? "");
    }
  }

  function chooseExactTime(value: string) {
    setScheduledTime(value);

    if (value) {
      setPlanningState("scheduled");
    }
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await onSubmit({
        title,
        description,
        importance,
        scheduledDate: planningState === "flexible" ? null : scheduledDate,
        scheduledTime: planningState === "scheduled" ? scheduledTime : null,
        plannedTimePreference:
          planningState === "flexible" ? null : plannedTimePreference,
        estimatedDurationMinutes,
        deadlineDate,
        reminderOffsets
      });
    } catch (error) {
      if (error instanceof TaskValidationError) {
        setFieldErrors({ [error.field]: error.message });
      } else {
        setErrorMessage("The task could not be saved. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  const reminderDisabledMessage = getReminderDisabledMessage(
    planningState,
    reminderSettings.status?.permissionStatus,
    reminderSettings.status?.settings.remindersEnabled
  );

  return (
    <form className="web-task-form" noValidate onSubmit={saveTask}>
      <div className="web-form-group">
        <label htmlFor="task-title">Title</label>
        <input
          aria-describedby={fieldErrors.title ? "task-title-error" : undefined}
          aria-invalid={fieldErrors.title ? true : undefined}
          autoFocus
          id="task-title"
          onChange={(event) => setTitle(event.currentTarget.value)}
          placeholder="What needs doing?"
          type="text"
          value={title}
        />
        <FieldError id="task-title-error" message={fieldErrors.title} />
      </div>

      <details
        className="web-task-details"
        onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
        open={detailsOpen}
      >
        <summary>Add planning details</summary>
        <div className="web-task-details-content">
          <div className="web-form-group">
            <label htmlFor="task-description">
              Notes <span>Optional</span>
            </label>
            <textarea
              id="task-description"
              onChange={(event) => setDescription(event.currentTarget.value)}
              placeholder="Optional context or next step"
              rows={4}
              value={description}
            />
          </div>

          <ChoiceFieldset<TaskImportance>
            legend="Importance"
            name="task-importance"
            onChange={setImportance}
            options={importanceOptions}
            value={importance}
          />

          <ChoiceFieldset<TaskPlanningState>
            help="Flexible has no date. Planned has a date and a soft preference; you can also add an exact time. Scheduled has an exact date and time."
            legend="Planning state"
            name="task-planning-state"
            onChange={choosePlanningState}
            options={planningOptions}
            value={planningState}
          />

          {planningState !== "flexible" ? (
            <div className="web-form-group">
              <label htmlFor="task-date">Planned date</label>
              <DateQuickChoices
                choices={getPlannedDateQuickChoices(referenceDate)}
                name="planned date"
                onChange={(value) => setScheduledDate(value ?? "")}
                value={scheduledDate}
              />
              <input
                aria-describedby={
                  fieldErrors.scheduledDate ? "task-date-error" : undefined
                }
                aria-invalid={fieldErrors.scheduledDate ? true : undefined}
                id="task-date"
                onChange={(event) => setScheduledDate(event.currentTarget.value)}
                type="date"
                value={scheduledDate}
              />
              <button
                className="web-text-button"
                onClick={() => choosePlanningState("flexible")}
                type="button"
              >
                Clear date · Make flexible
              </button>
              <FieldError id="task-date-error" message={fieldErrors.scheduledDate} />
            </div>
          ) : null}

          {planningState === "scheduled" ? (
            <div className="web-form-group">
              <label htmlFor="task-time">Scheduled time</label>
              <input
                aria-describedby={
                  fieldErrors.scheduledTime ? "task-time-error" : undefined
                }
                aria-invalid={fieldErrors.scheduledTime ? true : undefined}
                id="task-time"
                onChange={(event) => setScheduledTime(event.currentTarget.value)}
                type="time"
                value={scheduledTime}
              />
              <FieldError id="task-time-error" message={fieldErrors.scheduledTime} />
            </div>
          ) : null}

          {planningState === "planned" ? (
            <>
              <ChoiceFieldset<PlannedTimePreference>
                help="This guides scheduling suggestions but never blocks other available times."
                legend="Preferred time"
                name="task-planned-time-preference"
                onChange={setPlannedTimePreference}
                options={plannedTimePreferenceOptions}
                value={plannedTimePreference}
              />
              <div className="web-form-group">
                <label htmlFor="task-optional-time">
                  Exact start time <span>Optional</span>
                </label>
                <small id="task-optional-time-help">
                  Choosing a time makes this a Scheduled task and enables reminders.
                </small>
                <input
                  aria-describedby="task-optional-time-help"
                  id="task-optional-time"
                  onChange={(event) => chooseExactTime(event.currentTarget.value)}
                  type="time"
                  value={scheduledTime}
                />
              </div>
            </>
          ) : null}

          <fieldset className="web-choice-fieldset">
            <legend>Estimated duration</legend>
            <small>Choose a practical estimate if it helps.</small>
            <div className="web-choice-options">
              {durationOptions.map((duration) => (
                <label key={duration ?? "none"}>
                  <input
                    checked={duration === estimatedDurationMinutes}
                    name="task-duration"
                    onChange={() => setEstimatedDurationMinutes(duration)}
                    type="radio"
                    value={duration ?? "none"}
                  />
                  <span>{duration === null ? "No estimate" : `${duration} min`}</span>
                </label>
              ))}
            </div>
            <FieldError
              id="task-duration-error"
              message={fieldErrors.estimatedDurationMinutes}
            />
          </fieldset>

          <div className="web-form-group">
            <label htmlFor="task-deadline">
              Deadline <span>Optional</span>
            </label>
            <input
              aria-describedby={
                fieldErrors.deadlineDate
                  ? "task-deadline-help task-deadline-error"
                  : "task-deadline-help"
              }
              aria-invalid={fieldErrors.deadlineDate ? true : undefined}
              id="task-deadline"
              onChange={(event) => setDeadlineDate(event.currentTarget.value)}
              ref={deadlineInput}
              type="date"
              value={deadlineDate}
            />
            <DateQuickChoices
              choices={getDeadlineQuickChoices(referenceDate)}
              name="deadline"
              onChange={(value) => setDeadlineDate(value ?? "")}
              value={deadlineDate}
            />
            <button
              className="web-text-button"
              onClick={() => {
                deadlineInput.current?.focus();
                deadlineInput.current?.showPicker?.();
              }}
              type="button"
            >
              Choose date
            </button>
            <small id="task-deadline-help">
              A deadline is the last day to finish, not when you plan to work.
            </small>
            <FieldError id="task-deadline-error" message={fieldErrors.deadlineDate} />
          </div>

          {planningState === "scheduled" &&
          reminderSettings.status?.permissionStatus === "unsupported" ? (
            <section className="web-form-info" aria-labelledby="task-reminders-title">
              <strong id="task-reminders-title">Reminders</strong>
              <p>
                Browser notification delivery is not supported. Set task reminders in the
                Android app.
              </p>
              {reminderOffsets.length > 0 ? (
                <p>Saved choices: {formatReminderOffsets(reminderOffsets)}</p>
              ) : null}
            </section>
          ) : planningState === "scheduled" ? (
            <fieldset className="web-choice-fieldset">
              <legend>Reminders</legend>
              <small>
                {reminderDisabledMessage ??
                  `Optional. Choose up to ${maxRemindersPerItem}. ${reminderOffsets.length} selected.`}
              </small>
              <div className="web-choice-options">
                {reminderSelectionOptions.map((offset) => {
                  const checked = reminderOffsets.includes(offset);
                  const atLimit =
                    reminderOffsets.length >= maxRemindersPerItem && !checked;

                  return (
                    <label key={offset}>
                      <input
                        checked={checked}
                        disabled={Boolean(reminderDisabledMessage) || atLimit}
                        name="task-reminders"
                        onChange={() =>
                          setReminderOffsets((current) =>
                            checked
                              ? current.filter((candidate) => candidate !== offset)
                              : [...current, offset]
                          )
                        }
                        type="checkbox"
                        value={offset}
                      />
                      <span>{formatReminderOffset(offset)}</span>
                    </label>
                  );
                })}
              </div>
              <FieldError
                id="task-reminder-error"
                message={fieldErrors.reminderOffsets}
              />
            </fieldset>
          ) : null}

          {planningState !== "scheduled" && reminderOffsets.length > 0 ? (
            <p className="web-form-hint">
              Saved reminder choices are inactive until this task has a date and time.
            </p>
          ) : null}
        </div>
      </details>

      {errorMessage ? (
        <div className="web-error-notice" role="alert">
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <div className="web-form-actions">
        <button className="web-primary-button" disabled={isSaving} type="submit">
          {isSaving ? "Saving task..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function DateQuickChoices({
  choices,
  name,
  onChange,
  value
}: {
  choices: TaskDateQuickChoice[];
  name: string;
  onChange(value: string | null): void;
  value: string;
}) {
  return (
    <div aria-label={`${name} quick choices`} className="web-date-quick-choices">
      {choices.map((choice) => (
        <button
          aria-pressed={value === (choice.value ?? "")}
          className="web-choice-button"
          key={choice.label}
          onClick={() => onChange(choice.value)}
          type="button"
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

function ChoiceFieldset<T extends string>({
  help,
  legend,
  name,
  onChange,
  options,
  value
}: {
  help?: string | undefined;
  legend: string;
  name: string;
  onChange(value: T): void;
  options: { label: string; value: T }[];
  value: T;
}) {
  return (
    <fieldset className="web-choice-fieldset">
      <legend>{legend}</legend>
      {help ? <small>{help}</small> : null}
      <div className="web-choice-options">
        {options.map((option) => (
          <label key={option.value}>
            <input
              checked={option.value === value}
              name={name}
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FieldError({ id, message }: { id: string; message?: string | undefined }) {
  return message ? (
    <p className="web-validation-message" id={id} role="alert">
      {message}
    </p>
  ) : null;
}

function getReminderDisabledMessage(
  planningState: TaskPlanningState,
  permissionStatus: ReminderPermissionStatus | undefined,
  remindersEnabled: boolean | undefined
): string | null {
  if (planningState !== "scheduled") {
    return "Reminders are available after adding a date and time.";
  }

  if (permissionStatus === "denied" || permissionStatus === "unsupported") {
    return "Reminders are unavailable on this device or browser.";
  }

  if (remindersEnabled !== true) {
    return "Turn on reminders in Settings to choose them here.";
  }

  return null;
}

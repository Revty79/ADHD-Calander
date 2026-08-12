import { FormEvent, useRef, useState } from "react";

import { TaskValidationError } from "../../../database/repositories/errors";
import { ItemColorPicker } from "../../../components/ItemColorPicker";
import { ReminderEditor } from "../../reminders/components/ReminderEditor";
import { Reminder } from "../../../types/reminder";
import { ItemColor } from "../../../types/itemColor";
import {
  CreateTaskInput,
  getTaskPlanningState,
  Task,
  TaskImportance,
  TaskPlanningState
} from "../../../types/task";
import {
  getDeadlineQuickChoices,
  getPlannedDateQuickChoices,
  TaskDateQuickChoice
} from "../taskDateChoices";
import {
  buildTaskEditorInput,
  getTaskPlanningTransition,
  taskDurationOptions,
  taskImportanceOptions,
  taskPlanningOptions
} from "../taskEditorModel";

type FieldErrors = Partial<Record<TaskValidationError["field"], string>>;

type Props = {
  initialDate?: string;
  initialTask?: Task;
  onSubmit(input: CreateTaskInput): Promise<void>;
  submitLabel: string;
};

export function TaskEditorForm({
  initialDate = "",
  initialTask,
  onSubmit,
  submitLabel
}: Props) {
  const [title, setTitle] = useState(initialTask?.title ?? "");
  const [description, setDescription] = useState(initialTask?.description ?? "");
  const [importance, setImportance] = useState<TaskImportance>(
    initialTask?.importance ?? "normal"
  );
  const [color, setColor] = useState<ItemColor>(initialTask?.color ?? "neutral");
  const [planningState, setPlanningState] = useState<TaskPlanningState>(
    initialTask ? getTaskPlanningState(initialTask) : initialDate ? "planned" : "flexible"
  );
  const [scheduledDate, setScheduledDate] = useState(
    initialTask?.scheduledDate ?? initialDate
  );
  const [scheduledTime, setScheduledTime] = useState(initialTask?.scheduledTime ?? "");
  const [preferredTime, setPreferredTime] = useState(initialTask?.preferredTime ?? "");
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState<number | null>(
    initialTask?.estimatedDurationMinutes ?? null
  );
  const [deadlineDate, setDeadlineDate] = useState(initialTask?.deadlineDate ?? "");
  const [deadlineTime, setDeadlineTime] = useState(initialTask?.deadlineTime ?? "");
  const [reminders, setReminders] = useState<Reminder[]>(initialTask?.reminders ?? []);
  const [referenceDate] = useState(() => new Date());
  const deadlineInput = useRef<HTMLInputElement>(null);
  const [detailsOpen, setDetailsOpen] = useState(Boolean(initialTask || initialDate));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function choosePlanningState(nextState: TaskPlanningState) {
    const transition = getTaskPlanningTransition(
      nextState,
      scheduledDate,
      scheduledTime,
      preferredTime,
      getPlannedDateQuickChoices(referenceDate)[0]?.value ?? ""
    );

    setPlanningState(transition.planningState);
    setScheduledDate(transition.scheduledDate);
    setScheduledTime(transition.scheduledTime);
    setPreferredTime(transition.preferredTime);
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await onSubmit(
        buildTaskEditorInput({
          title,
          description,
          importance,
          color,
          planningState,
          scheduledDate,
          scheduledTime,
          preferredTime,
          estimatedDurationMinutes,
          deadlineDate,
          deadlineTime,
          reminders
        })
      );
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
            options={taskImportanceOptions}
            value={importance}
          />

          <ItemColorPicker onChange={setColor} value={color} />

          <ChoiceFieldset<TaskPlanningState>
            help="Flexible has no date. Planned has a date and optional preferred time. Scheduled has a fixed date and start time."
            legend="Planning state"
            name="task-planning-state"
            onChange={choosePlanningState}
            options={taskPlanningOptions}
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
            <div className="web-form-group">
              <label htmlFor="task-preferred-time">
                Preferred time <span>Optional</span>
              </label>
              <small id="task-preferred-time-help">
                This is a preference, not a fixed calendar reservation.
              </small>
              <input
                aria-describedby={
                  fieldErrors.preferredTime
                    ? "task-preferred-time-help task-preferred-time-error"
                    : "task-preferred-time-help"
                }
                aria-invalid={fieldErrors.preferredTime ? true : undefined}
                id="task-preferred-time"
                onChange={(event) => setPreferredTime(event.currentTarget.value)}
                type="time"
                value={preferredTime}
              />
              {preferredTime ? (
                <button
                  className="web-text-button"
                  onClick={() => setPreferredTime("")}
                  type="button"
                >
                  Clear preferred time
                </button>
              ) : null}
              <FieldError
                id="task-preferred-time-error"
                message={fieldErrors.preferredTime}
              />
            </div>
          ) : null}

          <fieldset className="web-choice-fieldset">
            <legend>Estimated duration</legend>
            <small>Choose a practical estimate if it helps.</small>
            <div className="web-choice-options">
              {taskDurationOptions.map((duration) => (
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
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDeadlineDate(value);

                if (!value) {
                  setDeadlineTime("");
                }
              }}
              ref={deadlineInput}
              type="date"
              value={deadlineDate}
            />
            <DateQuickChoices
              choices={getDeadlineQuickChoices(referenceDate)}
              name="deadline"
              onChange={(value) => {
                setDeadlineDate(value ?? "");

                if (value === null) {
                  setDeadlineTime("");
                }
              }}
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
            {deadlineDate ? (
              <button
                className="web-text-button"
                onClick={() => {
                  setDeadlineDate("");
                  setDeadlineTime("");
                }}
                type="button"
              >
                Clear deadline
              </button>
            ) : null}
            <FieldError id="task-deadline-error" message={fieldErrors.deadlineDate} />
          </div>

          {deadlineDate ? (
            <div className="web-form-group">
              <label htmlFor="task-deadline-time">
                Deadline time <span>Optional</span>
              </label>
              <small id="task-deadline-time-help">
                Without a time, the deadline is the end of the selected day.
              </small>
              <input
                aria-describedby={
                  fieldErrors.deadlineTime
                    ? "task-deadline-time-help task-deadline-time-error"
                    : "task-deadline-time-help"
                }
                aria-invalid={fieldErrors.deadlineTime ? true : undefined}
                id="task-deadline-time"
                onChange={(event) => setDeadlineTime(event.currentTarget.value)}
                type="time"
                value={deadlineTime}
              />
              {deadlineTime ? (
                <button
                  className="web-text-button"
                  onClick={() => setDeadlineTime("")}
                  type="button"
                >
                  Clear deadline time
                </button>
              ) : null}
              <FieldError
                id="task-deadline-time-error"
                message={fieldErrors.deadlineTime}
              />
            </div>
          ) : null}

          <ReminderEditor
            allowRelative={planningState === "scheduled"}
            deliveryMessage="Notification delivery is unavailable in the web build. Reminder choices still stay saved."
            error={fieldErrors.reminders ?? fieldErrors.reminderOffsets}
            onChange={setReminders}
            value={reminders}
          />
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

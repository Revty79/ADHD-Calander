import { Href, Link, useLocalSearchParams, useRouter } from "expo-router";
import { FormEvent, useMemo, useState } from "react";

import { useTaskRepository } from "../../src/database/DatabaseProvider";
import { TaskValidationError } from "../../src/database/repositories/errors";
import { normalizeLocalDateInput } from "../../src/utils/dates";

type NewTaskParams = {
  scheduledDate?: string;
  returnTo?: string;
};

type FieldErrors = Partial<Record<TaskValidationError["field"], string>>;

export default function WebNewTaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<NewTaskParams>();
  const taskRepository = useTaskRepository();
  const initialDate = useMemo(
    () => normalizeLocalDateInput(params.scheduledDate ?? "") ?? "",
    [params.scheduledDate]
  );
  const returnHref: Href =
    params.returnTo === "calendar"
      ? { pathname: "/calendar", params: { date: initialDate } }
      : params.returnTo === "tasks"
        ? "/tasks"
        : "/";
  const returnLabel =
    params.returnTo === "calendar"
      ? "Calendar"
      : params.returnTo === "tasks"
        ? "Tasks"
        : "Today";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState<string>(initialDate);
  const [scheduledTime, setScheduledTime] = useState("");
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await taskRepository.createTask({
        title,
        description,
        scheduledDate,
        scheduledTime,
        estimatedDurationMinutes: estimatedDurationMinutes.trim()
          ? Number(estimatedDurationMinutes)
          : null,
        deadlineDate
      });

      if (params.returnTo === "calendar") {
        router.replace({
          pathname: "/(tabs)/calendar",
          params: { date: scheduledDate }
        });
      } else {
        router.replace(params.returnTo === "tasks" ? "/(tabs)/tasks" : "/(tabs)");
      }
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
    <main className="web-form-shell">
      <div className="web-form-page">
        <Link className="web-back-link" href={returnHref}>
          Back to {returnLabel}
        </Link>

        <header className="web-form-header">
          <p className="web-eyebrow">Task details</p>
          <h1>New task</h1>
          <p>Scheduling is optional. Add a date when it helps you plan.</p>
        </header>

        <form className="web-task-form" noValidate onSubmit={saveTask}>
          <div className="web-form-group">
            <label htmlFor="task-title">Title</label>
            <input
              aria-describedby={fieldErrors.title ? "task-title-error" : undefined}
              aria-invalid={fieldErrors.title ? true : undefined}
              autoFocus
              id="task-title"
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder="Task title"
              required
              type="text"
              value={title}
            />
            {fieldErrors.title ? (
              <p className="web-validation-message" id="task-title-error" role="alert">
                {fieldErrors.title}
              </p>
            ) : null}
          </div>

          <div className="web-form-group">
            <label htmlFor="task-description">
              Description <span>Optional</span>
            </label>
            <textarea
              id="task-description"
              onChange={(event) => setDescription(event.currentTarget.value)}
              placeholder="Helpful details"
              rows={4}
              value={description}
            />
          </div>

          <div className="web-form-row">
            <div className="web-form-group">
              <label htmlFor="task-date">
                Scheduled date <span>Optional</span>
              </label>
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
              {fieldErrors.scheduledDate ? (
                <p className="web-validation-message" id="task-date-error" role="alert">
                  {fieldErrors.scheduledDate}
                </p>
              ) : null}
            </div>

            <div className="web-form-group">
              <label htmlFor="task-time">
                Scheduled time <span>Optional</span>
              </label>
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
              {fieldErrors.scheduledTime ? (
                <p className="web-validation-message" id="task-time-error" role="alert">
                  {fieldErrors.scheduledTime}
                </p>
              ) : null}
            </div>
          </div>

          <div className="web-form-group">
            <label htmlFor="task-duration">
              Estimated duration <span>Optional</span>
            </label>
            <input
              aria-describedby={
                fieldErrors.estimatedDurationMinutes ? "task-duration-error" : undefined
              }
              aria-invalid={fieldErrors.estimatedDurationMinutes ? true : undefined}
              id="task-duration"
              min="1"
              onChange={(event) => setEstimatedDurationMinutes(event.currentTarget.value)}
              placeholder="Minutes, for example 30"
              step="1"
              type="number"
              value={estimatedDurationMinutes}
            />
            {fieldErrors.estimatedDurationMinutes ? (
              <p className="web-validation-message" id="task-duration-error" role="alert">
                {fieldErrors.estimatedDurationMinutes}
              </p>
            ) : null}
          </div>

          <div className="web-form-group">
            <label htmlFor="task-deadline">
              Deadline <span>Optional</span>
            </label>
            <input
              aria-describedby={
                fieldErrors.deadlineDate
                  ? "task-deadline-error task-deadline-help"
                  : "task-deadline-help"
              }
              aria-invalid={fieldErrors.deadlineDate ? true : undefined}
              id="task-deadline"
              onChange={(event) => setDeadlineDate(event.currentTarget.value)}
              type="date"
              value={deadlineDate}
            />
            <small id="task-deadline-help">
              A deadline is the last day to finish, not the time you plan to work.
            </small>
            {fieldErrors.deadlineDate ? (
              <p className="web-validation-message" id="task-deadline-error" role="alert">
                {fieldErrors.deadlineDate}
              </p>
            ) : null}
          </div>

          {errorMessage ? (
            <div className="web-error-notice" role="alert">
              <p>{errorMessage}</p>
            </div>
          ) : null}

          <div className="web-form-actions">
            <button className="web-primary-button" disabled={isSaving} type="submit">
              {isSaving ? "Saving task..." : "Save task"}
            </button>
            <Link className="web-cancel-link" href={returnHref}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

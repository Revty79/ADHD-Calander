import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";

import { formatReminderOffset } from "../../../src/notifications/reminderRules";
import { useTaskDetail } from "../../../src/features/tasks/hooks/useTaskDetail";
import {
  getTaskImportanceLabel,
  getTaskPlanningLabel,
  getTaskStatusLabel
} from "../../../src/features/tasks/taskPresentation";
import { getTaskPlanningState, isTaskActive } from "../../../src/types/task";
import { formatLocalDateForDisplay } from "../../../src/utils/dates";

export default function WebTaskDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const taskId = typeof params.id === "string" ? params.id : "";
  const detail = useTaskDetail(taskId);
  const refresh = detail.refresh;
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function runAction(action: () => Promise<unknown>) {
    setIsUpdating(true);
    setActionError(null);

    try {
      await action();
      await detail.refresh();
    } catch (error) {
      console.error("Task action failed", error);
      setActionError(
        error instanceof Error ? error.message : "The task could not be updated."
      );
    } finally {
      setIsUpdating(false);
    }
  }

  if (detail.isLoading && !detail.task) {
    return (
      <main className="web-form-shell">
        <p aria-live="polite" className="web-loading-state" role="status">
          Loading task...
        </p>
      </main>
    );
  }

  if (!detail.task) {
    return (
      <main className="web-form-shell">
        <div className="web-form-page">
          <Link className="web-back-link" href="/tasks">
            Back to Tasks
          </Link>
          <div className="web-error-notice" role="alert">
            <p>{detail.errorMessage ?? "This task could not be found."}</p>
            <button
              className="web-secondary-button"
              onClick={detail.refresh}
              type="button"
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  const task = detail.task;
  const canSchedule = isTaskActive(task) && getTaskPlanningState(task) !== "scheduled";

  return (
    <main className="web-form-shell">
      <article className="web-task-detail-page">
        <Link className="web-back-link" href="/tasks">
          Back to Tasks
        </Link>

        <header className="web-task-detail-header">
          <div>
            <p className="web-eyebrow">{getTaskPlanningLabel(task)} task</p>
            <h1>{task.title}</h1>
            <p>{getTaskStatusLabel(task.status)}</p>
          </div>
          <Link
            className="web-primary-link"
            href={{ pathname: "/tasks/[id]/edit", params: { id: task.id } }}
          >
            Edit task
          </Link>
        </header>

        <div className="web-task-detail-grid">
          <div className="web-task-detail-main">
            {task.description ? (
              <section className="web-detail-panel">
                <h2>Notes</h2>
                <p>{task.description}</p>
              </section>
            ) : null}

            <section className="web-detail-panel">
              <h2>Task details</h2>
              <dl className="web-detail-list">
                <DetailRow
                  label="Importance"
                  value={getTaskImportanceLabel(task.importance)}
                />
                <DetailRow label="Planning state" value={getTaskPlanningLabel(task)} />
                <DetailRow
                  label="Planned date"
                  value={
                    task.scheduledDate
                      ? formatLocalDateForDisplay(task.scheduledDate)
                      : "No planned date"
                  }
                />
                <DetailRow
                  label="Scheduled time"
                  value={task.scheduledTime ?? "No time"}
                />
                <DetailRow
                  label="Deadline"
                  value={
                    task.deadlineDate
                      ? formatLocalDateForDisplay(task.deadlineDate)
                      : "No deadline"
                  }
                />
                <DetailRow
                  label="Estimated duration"
                  value={
                    task.estimatedDurationMinutes
                      ? `${task.estimatedDurationMinutes} minutes`
                      : "No estimate"
                  }
                />
                <DetailRow
                  label="Reminder"
                  value={formatReminderOffset(task.reminderOffsetMinutes)}
                />
                {task.completedAt ? (
                  <DetailRow
                    label="Completed"
                    value={new Date(task.completedAt).toLocaleString()}
                  />
                ) : null}
              </dl>
            </section>

            {detail.parentTask ? (
              <section className="web-detail-panel web-relationship-panel">
                <h2>Part of</h2>
                <Link
                  href={{ pathname: "/tasks/[id]", params: { id: detail.parentTask.id } }}
                >
                  {detail.parentTask.title}
                </Link>
              </section>
            ) : null}

            {detail.childTasks.length > 0 ? (
              <section className="web-detail-panel web-relationship-panel">
                <h2>Smaller tasks</h2>
                <ul className="web-child-task-list">
                  {detail.childTasks.map((child) => (
                    <li key={child.id}>
                      <span>
                        <Link
                          href={{ pathname: "/tasks/[id]", params: { id: child.id } }}
                        >
                          {child.title}
                        </Link>
                        <small>{getTaskStatusLabel(child.status)}</small>
                      </span>
                      {isTaskActive(child) ? (
                        <button
                          className="web-secondary-button"
                          disabled={isUpdating}
                          onClick={() =>
                            runAction(() => detail.repository.completeTask(child.id))
                          }
                          type="button"
                        >
                          Complete
                        </button>
                      ) : child.status === "completed" ? (
                        <button
                          className="web-secondary-button"
                          disabled={isUpdating}
                          onClick={() =>
                            runAction(() =>
                              detail.repository.undoTaskCompletion(child.id)
                            )
                          }
                          type="button"
                        >
                          Undo
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="web-task-action-panel">
            <h2>Actions</h2>
            {canSchedule ? (
              <Link
                className="web-primary-link"
                href={{ pathname: "/tasks/[id]/schedule", params: { id: task.id } }}
              >
                Help me find a time
              </Link>
            ) : null}
            {isTaskActive(task) ? (
              <>
                <button
                  className="web-secondary-button"
                  disabled={isUpdating}
                  onClick={() => runAction(() => detail.repository.completeTask(task.id))}
                  type="button"
                >
                  Complete
                </button>
                <Link
                  className="web-secondary-link"
                  href={{ pathname: "/tasks/[id]/breakdown", params: { id: task.id } }}
                >
                  Break into smaller tasks
                </Link>
                <button
                  className="web-quiet-danger"
                  disabled={isUpdating}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Remove this task from active tasks? It will stay in history and can be restored."
                      )
                    ) {
                      runAction(() => detail.repository.removeTask(task.id));
                    }
                  }}
                  type="button"
                >
                  Remove from active tasks
                </button>
              </>
            ) : null}
            {task.status === "completed" ? (
              <button
                className="web-secondary-button"
                disabled={isUpdating}
                onClick={() =>
                  runAction(() => detail.repository.undoTaskCompletion(task.id))
                }
                type="button"
              >
                Undo completion
              </button>
            ) : null}
            {task.status === "removed" ? (
              <button
                className="web-secondary-button"
                disabled={isUpdating}
                onClick={() => runAction(() => detail.repository.restoreTask(task.id))}
                type="button"
              >
                Restore task
              </button>
            ) : null}
            {task.status === "broken_down" ? (
              <button
                className="web-secondary-button"
                disabled={isUpdating}
                onClick={() =>
                  runAction(() => detail.repository.undoTaskBreakdown(task.id))
                }
                type="button"
              >
                Undo breakdown
              </button>
            ) : null}
          </aside>
        </div>

        {actionError || detail.errorMessage ? (
          <div className="web-error-notice" role="alert">
            <p>{actionError ?? detail.errorMessage}</p>
          </div>
        ) : null}
      </article>
    </main>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

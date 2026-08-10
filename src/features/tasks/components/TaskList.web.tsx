import { Link } from "expo-router";

import { formatReminderOffsets } from "../../../notifications/reminderRules";
import { isTaskActive, Task } from "../../../types/task";
import { formatLocalDateForDisplay } from "../../../utils/dates";
import {
  getTaskImportanceLabel,
  getTaskPlanningLabel,
  getTaskStatusLabel,
  getTaskTimingNote
} from "../taskPresentation";

type TaskListProps = {
  title: string;
  emptyMessage: string;
  tasks: Task[];
  actionLabel?: string;
  onAction?(id: string): void;
  onPause?(id: string): void;
  onSchedule?(id: string): void;
  onStart?(id: string): void;
  showDate?: boolean;
};

export function TaskList({
  title,
  emptyMessage,
  tasks,
  actionLabel,
  onAction,
  onPause,
  onSchedule,
  onStart,
  showDate = false
}: TaskListProps) {
  return (
    <section className="web-task-section">
      <div className="web-section-heading">
        <h2>{title}</h2>
        <span className="web-count-badge">
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="web-empty-state">{emptyMessage}</p>
      ) : (
        <ul className="web-task-list">
          {tasks.map((task) => (
            <li className="web-task-card" key={task.id}>
              <div className="web-task-copy">
                <h3>
                  <Link
                    className="web-task-title-link"
                    href={{ pathname: "/tasks/[id]", params: { id: task.id } }}
                  >
                    {task.title}
                  </Link>
                </h3>
                {task.description ? <p>{task.description}</p> : null}
                <div className="web-task-meta">
                  {showDate ? (
                    task.scheduledDate ? (
                      <time dateTime={task.scheduledDate}>
                        {formatLocalDateForDisplay(task.scheduledDate)}
                      </time>
                    ) : (
                      <span>No planned date</span>
                    )
                  ) : null}
                  {task.scheduledTime ? (
                    <time dateTime={task.scheduledTime}>{task.scheduledTime}</time>
                  ) : null}
                  {task.estimatedDurationMinutes ? (
                    <span>{task.estimatedDurationMinutes} min estimate</span>
                  ) : null}
                  {task.deadlineDate ? (
                    <span>Deadline {formatLocalDateForDisplay(task.deadlineDate)}</span>
                  ) : null}
                  {task.reminderOffsets.length > 0 ? (
                    <span>Reminders: {formatReminderOffsets(task.reminderOffsets)}</span>
                  ) : null}
                  <span>{getTaskPlanningLabel(task)}</span>
                  <span>{getTaskImportanceLabel(task.importance)}</span>
                  {task.parentTaskId ? <span>Smaller task</span> : null}
                  <span>Status: {getTaskStatusLabel(task.status)}</span>
                </div>
                {getTaskTimingNote(task) ? (
                  <p className="web-task-timing-note">{getTaskTimingNote(task)}</p>
                ) : null}
              </div>
              {(actionLabel && onAction) || onStart || onPause ? (
                <div className="web-task-actions">
                  {task.status === "not_started" && onStart ? (
                    <button
                      aria-label={`Start task ${task.title}`}
                      className="web-gentle-action-button"
                      onClick={() => onStart(task.id)}
                      type="button"
                    >
                      Start task
                    </button>
                  ) : null}
                  {task.status === "started" && onPause ? (
                    <button
                      aria-label={`Pause ${task.title} for now`}
                      className="web-gentle-action-button"
                      onClick={() => onPause(task.id)}
                      type="button"
                    >
                      Pause for now
                    </button>
                  ) : null}
                  {onSchedule && isTaskActive(task) && task.scheduledTime === null ? (
                    <button
                      aria-label={`Help me schedule ${task.title}`}
                      className="web-primary-button web-task-schedule-button"
                      onClick={() => onSchedule(task.id)}
                      type="button"
                    >
                      Help me schedule
                    </button>
                  ) : null}
                  {actionLabel && onAction ? (
                    <button
                      aria-label={`${actionLabel} ${task.title}`}
                      className="web-secondary-button"
                      onClick={() => onAction(task.id)}
                      type="button"
                    >
                      {actionLabel}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

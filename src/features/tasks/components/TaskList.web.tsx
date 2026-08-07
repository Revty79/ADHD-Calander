import { Task } from "../../../types/task";
import { formatLocalDateForDisplay } from "../../../utils/dates";

type TaskListProps = {
  title: string;
  emptyMessage: string;
  tasks: Task[];
  actionLabel?: string;
  onAction?(id: string): void;
  showDate?: boolean;
};

export function TaskList({
  title,
  emptyMessage,
  tasks,
  actionLabel,
  onAction,
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
                <h3>{task.title}</h3>
                {task.description ? <p>{task.description}</p> : null}
                <div className="web-task-meta">
                  {showDate ? (
                    task.scheduledDate ? (
                      <time dateTime={task.scheduledDate}>
                        {formatLocalDateForDisplay(task.scheduledDate)}
                      </time>
                    ) : (
                      <span>Unscheduled</span>
                    )
                  ) : null}
                  {task.scheduledTime ? (
                    <time dateTime={task.scheduledTime}>{task.scheduledTime}</time>
                  ) : null}
                  {task.estimatedDurationMinutes ? (
                    <span>{task.estimatedDurationMinutes} min estimate</span>
                  ) : null}
                  <span>Status: {getTaskStatusLabel(task.status)}</span>
                </div>
              </div>
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function getTaskStatusLabel(status: Task["status"]): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "delegated":
      return "Delegated";
    case "removed":
      return "Removed from active tasks";
    case "broken_down":
      return "Broken into smaller tasks";
    default:
      return "Not started";
  }
}

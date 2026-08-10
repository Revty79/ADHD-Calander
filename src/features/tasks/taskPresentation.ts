import {
  getTaskPlanningState,
  isTaskActive,
  Task,
  TaskImportance
} from "../../types/task";
import {
  formatLocalDateForDisplay,
  formatLocalTimeForDisplay,
  getLocalDateString,
  getLocalTimeString
} from "../../utils/dates";

export function getTaskStatusLabel(status: Task["status"]): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "started":
      return "In progress";
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

export function getTaskTimingNote(task: Task, now = new Date()): string | null {
  if (!isTaskActive(task)) {
    return null;
  }

  const today = getLocalDateString(now);

  if (
    task.deadlineDate !== null &&
    (task.deadlineDate < today ||
      (task.deadlineDate === today &&
        task.deadlineTime !== null &&
        task.deadlineTime < getLocalTimeString(now)))
  ) {
    return "Deadline passed · Still open";
  }

  if (
    task.scheduledDate !== null &&
    (task.scheduledDate < today ||
      (task.scheduledDate === today &&
        task.scheduledTime !== null &&
        task.scheduledTime < getLocalTimeString(now)))
  ) {
    return "Planned time passed · Still open";
  }

  return null;
}

export function getTaskImportanceLabel(importance: TaskImportance): string {
  switch (importance) {
    case "important":
      return "Important";
    case "low":
      return "Low importance";
    default:
      return "Normal importance";
  }
}

export function getTaskPlanningLabel(task: Task): string {
  switch (getTaskPlanningState(task)) {
    case "scheduled":
      return "Scheduled";
    case "planned":
      return "Planned";
    default:
      return "Flexible";
  }
}

export function getTaskDeadlineLabel(task: Task): string {
  if (task.deadlineDate === null) {
    return "No deadline";
  }

  const date = formatLocalDateForDisplay(task.deadlineDate);

  return task.deadlineTime === null
    ? `${date} · End of day`
    : `${date} at ${formatLocalTimeForDisplay(task.deadlineTime)}`;
}

export function getTaskPreferredTimeLabel(task: Task): string | null {
  return task.preferredTime === null
    ? null
    : `Preferred ${formatLocalTimeForDisplay(task.preferredTime)}`;
}

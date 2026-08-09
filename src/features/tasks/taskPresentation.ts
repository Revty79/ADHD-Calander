import {
  getTaskPlanningState,
  isTaskActive,
  Task,
  TaskImportance
} from "../../types/task";
import { getLocalDateString, getLocalTimeString } from "../../utils/dates";

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

  if (task.deadlineDate !== null && task.deadlineDate < today) {
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

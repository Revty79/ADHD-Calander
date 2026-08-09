import { getTaskPlanningState, Task, TaskImportance } from "../../types/task";

export function getTaskStatusLabel(status: Task["status"]): string {
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

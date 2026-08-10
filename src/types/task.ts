import { LocalDateString, LocalTimeString } from "./dateTime";
import { Reminder, ReminderInput, ReminderOffsetMinutes } from "./reminder";

export const implementedTaskStatuses = [
  "not_started",
  "started",
  "completed",
  "delegated",
  "removed",
  "broken_down"
] as const;

export const reservedTaskStatuses = [
  "partially_completed",
  "intentionally_skipped",
  "rescheduled",
  "recovery_queue",
  "no_longer_necessary"
] as const;

export const taskStatuses = [
  ...implementedTaskStatuses,
  ...reservedTaskStatuses
] as const;

export type ImplementedTaskStatus = (typeof implementedTaskStatuses)[number];
export type TaskStatus = (typeof taskStatuses)[number];

export const taskImportances = ["low", "normal", "important"] as const;
export type TaskImportance = (typeof taskImportances)[number];

export type TaskPlanningState = "flexible" | "planned" | "scheduled";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  importance: TaskImportance;
  status: TaskStatus;
  parentTaskId: string | null;
  scheduledDate: LocalDateString | null;
  scheduledTime: LocalTimeString | null;
  preferredTime: LocalTimeString | null;
  estimatedDurationMinutes: number | null;
  deadlineDate: LocalDateString | null;
  deadlineTime: LocalTimeString | null;
  reminders: Reminder[];
  reminderOffsets: ReminderOffsetMinutes[];
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
};

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  importance?: TaskImportance;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  preferredTime?: string | null;
  estimatedDurationMinutes?: number | null;
  deadlineDate?: string | null;
  deadlineTime?: string | null;
  reminders?: ReminderInput[];
  reminderOffsets?: number[];
};

export type UpdateTaskInput = CreateTaskInput;

export type BreakDownTaskInput = {
  titles: string[];
};

export type ScheduleTaskInput = {
  scheduledDate: string;
  scheduledTime: string;
  estimatedDurationMinutes?: number;
};

export const resolvedTaskStatuses: readonly TaskStatus[] = [
  "delegated",
  "removed",
  "broken_down",
  "intentionally_skipped",
  "no_longer_necessary"
];

export function isTaskCompleted(task: Task): boolean {
  return task.status === "completed";
}

export function isTaskResolved(task: Task): boolean {
  return resolvedTaskStatuses.includes(task.status);
}

export function isTaskActive(task: Task): boolean {
  return !isTaskCompleted(task) && !isTaskResolved(task);
}

export function getTaskPlanningState(task: Task): TaskPlanningState {
  if (task.scheduledDate === null) {
    return "flexible";
  }

  return task.scheduledTime === null ? "planned" : "scheduled";
}

export type { LocalDateString, LocalTimeString } from "./dateTime";

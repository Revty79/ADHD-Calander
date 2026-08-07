import { LocalDateString, LocalTimeString } from "./dateTime";

export const implementedTaskStatuses = [
  "not_started",
  "completed",
  "delegated",
  "removed",
  "broken_down"
] as const;

export const reservedTaskStatuses = [
  "started",
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
export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  scheduledDate: LocalDateString | null;
  scheduledTime: LocalTimeString | null;
  estimatedDurationMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
};

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  estimatedDurationMinutes?: number | null;
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

export type { LocalDateString, LocalTimeString } from "./dateTime";

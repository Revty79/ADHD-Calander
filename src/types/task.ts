import { LocalDateString, LocalTimeString } from "./dateTime";

export const implementedTaskStatuses = ["not_started", "completed"] as const;

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

export type { LocalDateString, LocalTimeString } from "./dateTime";

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
export type LocalDateString = `${number}-${number}-${number}`;
export type LocalTimeString = `${number}:${number}`;

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  scheduledDate: LocalDateString;
  scheduledTime: LocalTimeString | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
};

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  scheduledDate: string;
  scheduledTime?: string | null;
};

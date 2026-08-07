import { LocalDateString, LocalTimeString } from "./dateTime";
import { TaskStatus } from "./task";

export const recoverySessionStatuses = ["active", "completed"] as const;
export const recoveryItemStatuses = ["pending", "resolved"] as const;
export const recoveryDecisionTypes = [
  "keep",
  "reschedule",
  "break_down",
  "delegate",
  "remove",
  "skip"
] as const;

export type RecoverySessionStatus = (typeof recoverySessionStatuses)[number];
export type RecoveryItemStatus = (typeof recoveryItemStatuses)[number];
export type RecoveryDecisionType = (typeof recoveryDecisionTypes)[number];

export type RecoveryItem = {
  id: string;
  sessionId: string;
  taskId: string;
  originalTitle: string;
  originalStatus: TaskStatus;
  originalScheduledDate: LocalDateString;
  originalScheduledTime: LocalTimeString | null;
  originalEstimatedDurationMinutes: number | null;
  status: RecoveryItemStatus;
  decision: RecoveryDecisionType | null;
  note: string | null;
  rescheduledDate: LocalDateString | null;
  rescheduledTime: LocalTimeString | null;
  createdTaskIds: string[];
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecoverySession = {
  id: string;
  sourceDate: LocalDateString;
  status: RecoverySessionStatus;
  startedAt: string;
  completedAt: string | null;
  items: RecoveryItem[];
};

export type RescheduleRecoveryInput = {
  scheduledDate: string;
  scheduledTime?: string | null;
};

export type BreakDownRecoveryInput = {
  titles: string[];
};

export type DelegateRecoveryInput = {
  note?: string | null;
};

export function getResolvedRecoveryItemCount(session: RecoverySession): number {
  return session.items.filter((item) => item.status === "resolved").length;
}

export function getNextRecoveryItem(session: RecoverySession): RecoveryItem | null {
  return (
    session.items.find((item) => item.status === "pending" && item.decision !== "skip") ??
    session.items.find((item) => item.status === "pending") ??
    null
  );
}

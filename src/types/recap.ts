import { CalendarEvent } from "./calendarEvent";
import { LocalDateString } from "./dateTime";
import { Task } from "./task";

export const recapRecoveryDecisionTypes = [
  "keep",
  "reschedule",
  "break_down",
  "delegate",
  "remove"
] as const;

export type RecapRecoveryDecisionType = (typeof recapRecoveryDecisionTypes)[number];

export type RecapOpenReason = "scheduled" | "kept_active" | "waiting_decision";

export type RecapOpenTask = {
  task: Task;
  reason: RecapOpenReason;
};

export type RecoveryRecapSummary = {
  sessionCount: number;
  decisionCounts: Record<RecapRecoveryDecisionType, number>;
  totalDecisionCount: number;
  waitingDecisionCount: number;
};

export type DailyRecap = {
  date: LocalDateString;
  accomplishedTasks: Task[];
  completedEstimatedMinutes: number;
  fixedEvents: CalendarEvent[];
  recovery: RecoveryRecapSummary;
  stillOpenTasks: RecapOpenTask[];
  encouragement: string;
};

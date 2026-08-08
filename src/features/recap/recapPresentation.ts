import { CalendarEvent } from "../../types/calendarEvent";
import { RecapOpenReason, RecapRecoveryDecisionType } from "../../types/recap";

const recoveryDecisionLabels: Record<RecapRecoveryDecisionType, [string, string]> = {
  keep: ["task kept active", "tasks kept active"],
  reschedule: ["task rescheduled", "tasks rescheduled"],
  break_down: ["task broken into smaller steps", "tasks broken into smaller steps"],
  delegate: ["task delegated", "tasks delegated"],
  remove: ["task removed from the plan", "tasks removed from the plan"]
};

const openReasonLabels: Record<RecapOpenReason, string> = {
  scheduled: "Scheduled for this date",
  kept_active: "Kept active and unscheduled",
  waiting_decision: "Waiting for a decision"
};

export function formatCompletionTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

export function formatEventTime(event: CalendarEvent): string {
  return event.endTime ? `${event.startTime}-${event.endTime}` : event.startTime;
}

export function formatRecoveryDecision(
  decision: RecapRecoveryDecisionType,
  count: number
): string {
  const labels = recoveryDecisionLabels[decision];

  return `${count} ${count === 1 ? labels[0] : labels[1]}`;
}

export function getOpenReasonLabel(reason: RecapOpenReason): string {
  return openReasonLabels[reason];
}

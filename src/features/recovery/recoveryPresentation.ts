import { RecoveryDecisionType } from "../../types/recovery";

export function getRecoveryDecisionLabel(decision: RecoveryDecisionType | null): string {
  switch (decision) {
    case "keep":
      return "Kept, unscheduled";
    case "reschedule":
      return "Rescheduled";
    case "break_down":
      return "Broken into smaller tasks";
    case "delegate":
      return "Delegated";
    case "remove":
      return "Removed from active tasks";
    case "skip":
      return "Decide later";
    default:
      return "Not decided";
  }
}

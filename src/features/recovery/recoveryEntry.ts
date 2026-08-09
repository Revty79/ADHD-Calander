import { RecoveryRepository } from "../../database/repositories/recoveryRepository";
import { RecoverySession } from "../../types/recovery";

export type RecoveryEntryDecision = "confirm" | "cancel";

export async function applyRecoveryEntryDecision(
  decision: RecoveryEntryDecision,
  repository: Pick<RecoveryRepository, "startSession">,
  sourceDate: string
): Promise<RecoverySession | null> {
  if (decision === "cancel") {
    return null;
  }

  return repository.startSession(sourceDate);
}

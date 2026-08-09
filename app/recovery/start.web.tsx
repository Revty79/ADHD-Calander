import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { useRecoveryRepository } from "../../src/database/DatabaseProvider";
import { applyRecoveryEntryDecision } from "../../src/features/recovery/recoveryEntry";
import { RecoverySession } from "../../src/types/recovery";
import { formatLocalDateForDisplay, getLocalDateString } from "../../src/utils/dates";

export default function WebStartRecoveryScreen() {
  const router = useRouter();
  const repository = useRecoveryRepository();
  const [activeSession, setActiveSession] = useState<RecoverySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const today = getLocalDateString();

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setActiveSession(await repository.getActiveSession());
    } catch (error) {
      console.error("Failed to prepare Recovery Mode", error);
      setErrorMessage("Recovery Mode could not be prepared. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function confirmEntry() {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await applyRecoveryEntryDecision("confirm", repository, today);
      router.replace("/(tabs)/recovery");
    } catch (error) {
      console.error("Failed to enter Recovery Mode", error);
      setErrorMessage("Recovery Mode could not be started. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function cancelEntry() {
    await applyRecoveryEntryDecision("cancel", repository, today);
    router.back();
  }

  return (
    <main className="web-form-shell">
      <section className="web-recovery-entry-panel">
        <p className="web-eyebrow">A safe reset point</p>
        <h1>Plans changed?</h1>
        <p>
          Review unfinished work one task at a time. Nothing will be moved, completed, or
          removed until you choose what happens next.
        </p>

        {isLoading ? (
          <p aria-live="polite" role="status">
            Checking for an active Recovery review...
          </p>
        ) : null}

        {errorMessage ? (
          <div className="web-error-notice" role="alert">
            <p>{errorMessage}</p>
            <button className="web-secondary-button" onClick={refresh} type="button">
              Retry
            </button>
          </div>
        ) : null}

        {!isLoading && activeSession ? (
          <p className="web-recovery-entry-notice">
            A Recovery review for {formatLocalDateForDisplay(activeSession.sourceDate)}
            is already active. You can continue where you left off.
          </p>
        ) : !isLoading ? (
          <p className="web-recovery-entry-notice">
            Start a review of unfinished tasks planned for{" "}
            {formatLocalDateForDisplay(today)}.
          </p>
        ) : null}

        <div className="web-form-actions">
          <button
            className="web-primary-button"
            disabled={isLoading || isSaving}
            onClick={confirmEntry}
            type="button"
          >
            {isSaving
              ? "Opening..."
              : activeSession
                ? "Resume Recovery"
                : "Start Recovery"}
          </button>
          <button
            className="web-secondary-button"
            disabled={isSaving}
            onClick={cancelEntry}
            type="button"
          >
            Not now
          </button>
        </div>
      </section>
    </main>
  );
}

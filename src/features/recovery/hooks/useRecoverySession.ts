import { useCallback, useState } from "react";

import { useRecoveryRepository } from "../../../database/DatabaseProvider";
import { RecoverySession } from "../../../types/recovery";

type RecoveryOperation = () => Promise<RecoverySession>;

export function useRecoverySession() {
  const repository = useRecoveryRepository();
  const [session, setSession] = useState<RecoverySession | null>(null);
  const [latestCompletedSession, setLatestCompletedSession] =
    useState<RecoverySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [activeSession, completedSession] = await Promise.all([
        repository.getActiveSession(),
        repository.getLatestCompletedSession()
      ]);
      setSession(activeSession);
      setLatestCompletedSession(completedSession);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Recovery Mode could not be loaded."));
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  const runOperation = useCallback(async (operation: RecoveryOperation) => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      setSession(await operation());
      return true;
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "That decision could not be saved."));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const startSession = useCallback(
    (sourceDate: string) => runOperation(() => repository.startSession(sourceDate)),
    [repository, runOperation]
  );

  const keepTask = useCallback(
    (itemId: string) => runOperation(() => repository.keepTask(itemId)),
    [repository, runOperation]
  );

  const rescheduleTask = useCallback(
    (itemId: string, scheduledDate: string, scheduledTime?: string | null) =>
      runOperation(() =>
        repository.rescheduleTask(itemId, {
          scheduledDate,
          ...(scheduledTime === undefined ? {} : { scheduledTime })
        })
      ),
    [repository, runOperation]
  );

  const breakDownTask = useCallback(
    (itemId: string, titles: string[]) =>
      runOperation(() => repository.breakDownTask(itemId, { titles })),
    [repository, runOperation]
  );

  const delegateTask = useCallback(
    (itemId: string, note?: string | null) =>
      runOperation(() =>
        repository.delegateTask(itemId, note === undefined ? {} : { note })
      ),
    [repository, runOperation]
  );

  const removeTask = useCallback(
    (itemId: string) => runOperation(() => repository.removeTask(itemId)),
    [repository, runOperation]
  );

  const skipTask = useCallback(
    (itemId: string) => runOperation(() => repository.skipTask(itemId)),
    [repository, runOperation]
  );

  const reopenItem = useCallback(
    (itemId: string) => runOperation(() => repository.reopenItem(itemId)),
    [repository, runOperation]
  );

  const completeSession = useCallback(async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const completedSession = await repository.completeSession();
      setLatestCompletedSession(completedSession);
      setSession(null);
      return true;
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Recovery Mode could not be finished yet."));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [repository]);

  return {
    session,
    latestCompletedSession,
    isLoading,
    isSaving,
    errorMessage,
    clearError: () => setErrorMessage(null),
    refresh,
    startSession,
    keepTask,
    rescheduleTask,
    breakDownTask,
    delegateTask,
    removeTask,
    skipTask,
    reopenItem,
    completeSession
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

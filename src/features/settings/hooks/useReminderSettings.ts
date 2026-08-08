import { useCallback, useEffect, useState } from "react";

import { useReminderService } from "../../../database/DatabaseProvider";
import { ReminderServiceStatus } from "../../../notifications/reminderService";

export function useReminderSettings() {
  const reminderService = useReminderService();
  const [status, setStatus] = useState<ReminderServiceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setErrorMessage(null);

    try {
      setStatus(await reminderService.getStatus());
    } catch {
      setErrorMessage("Reminder settings could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [reminderService]);

  useEffect(() => {
    let isActive = true;

    reminderService
      .getStatus()
      .then((nextStatus) => {
        if (isActive) {
          setStatus(nextStatus);
        }
      })
      .catch(() => {
        if (isActive) {
          setErrorMessage("Reminder settings could not be loaded. Please try again.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [reminderService]);

  const setRemindersEnabled = useCallback(
    async (enabled: boolean) => {
      setIsSaving(true);
      setErrorMessage(null);

      try {
        const nextStatus = await reminderService.setRemindersEnabled(enabled);
        setStatus(nextStatus);
        return nextStatus;
      } catch {
        setErrorMessage("Reminder settings could not be saved. Please try again.");
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [reminderService]
  );

  return {
    errorMessage,
    isLoading,
    isSaving,
    refresh,
    setRemindersEnabled,
    status
  };
}

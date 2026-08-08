import { useCallback, useEffect, useState } from "react";

import { useSchedulingService } from "../../../database/DatabaseProvider";
import { Task } from "../../../types/task";
import { SchedulingSearchResult, SchedulingSuggestion } from "../types";

export const practicalDurationOptions = [10, 15, 30, 45, 60, 90, 120] as const;

export function useSchedulingSuggestions(taskId: string) {
  const service = useSchedulingService();
  const [result, setResult] = useState<SchedulingSearchResult | null>(null);
  const [durationOverride, setDurationOverride] = useState<number | undefined>();
  const [horizonDays, setHorizonDays] = useState(7);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSuggestions = useCallback(async () => {
    if (!taskId) {
      setResult(null);
      setErrorMessage("This task could not be found. Return to Tasks and try again.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextResult = await service.getSuggestions(taskId, {
        ...(durationOverride === undefined ? {} : { durationMinutes: durationOverride }),
        horizonDays
      });
      setResult(nextResult);
    } catch {
      setResult(null);
      setErrorMessage("Scheduling suggestions could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [durationOverride, horizonDays, service, taskId]);

  useEffect(() => {
    let isActive = true;

    service
      .getSuggestions(taskId, {
        ...(durationOverride === undefined ? {} : { durationMinutes: durationOverride }),
        horizonDays
      })
      .then((nextResult) => {
        if (isActive) {
          setResult(nextResult);
        }
      })
      .catch(() => {
        if (isActive) {
          setResult(null);
          setErrorMessage(
            taskId
              ? "Scheduling suggestions could not be loaded. Please try again."
              : "This task could not be found. Return to Tasks and try again."
          );
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
  }, [durationOverride, horizonDays, service, taskId]);

  const acceptSuggestion = useCallback(
    async (suggestion: SchedulingSuggestion): Promise<Task | null> => {
      setIsAccepting(true);
      setErrorMessage(null);

      try {
        return await service.acceptSuggestion(taskId, suggestion, {
          ...(durationOverride === undefined
            ? {}
            : { durationMinutes: durationOverride }),
          horizonDays
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "This task could not be scheduled. Please try again.";
        await loadSuggestions();
        setErrorMessage(message);
        return null;
      } finally {
        setIsAccepting(false);
      }
    },
    [durationOverride, horizonDays, loadSuggestions, service, taskId]
  );

  return {
    result,
    durationOverride,
    horizonDays,
    isLoading,
    isAccepting,
    errorMessage,
    refresh: loadSuggestions,
    chooseDuration: (durationMinutes: number) => {
      setIsLoading(true);
      setErrorMessage(null);
      setResult(null);
      setDurationOverride(durationMinutes);
    },
    lookFartherAhead: () => {
      setIsLoading(true);
      setErrorMessage(null);
      setResult(null);
      setHorizonDays(14);
    },
    acceptSuggestion
  };
}

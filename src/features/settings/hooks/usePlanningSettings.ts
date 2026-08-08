import { useCallback, useEffect, useState } from "react";

import { useSettingsRepository } from "../../../database/DatabaseProvider";
import { AppSettings, PlanningPreferences } from "../../../types/settings";

export function usePlanningSettings() {
  const settingsRepository = useSettingsRepository();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setErrorMessage(null);

    try {
      setSettings(await settingsRepository.getSettings());
    } catch {
      setErrorMessage("Planning settings could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [settingsRepository]);

  useEffect(() => {
    let isActive = true;

    settingsRepository
      .getSettings()
      .then((nextSettings) => {
        if (isActive) {
          setSettings(nextSettings);
        }
      })
      .catch(() => {
        if (isActive) {
          setErrorMessage("Planning settings could not be loaded. Please try again.");
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
  }, [settingsRepository]);

  const setPreference = useCallback(
    async <Key extends keyof PlanningPreferences>(
      key: Key,
      value: PlanningPreferences[Key]
    ) => {
      setIsSaving(true);
      setErrorMessage(null);

      try {
        const nextSettings = await settingsRepository.setPlanningPreference(key, value);
        setSettings(nextSettings);
        return nextSettings;
      } catch {
        setErrorMessage("Planning settings could not be saved. Please try again.");
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [settingsRepository]
  );

  return {
    errorMessage,
    isLoading,
    isSaving,
    refresh,
    setPreference,
    settings
  };
}

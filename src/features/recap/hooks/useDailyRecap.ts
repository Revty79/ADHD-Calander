import { useCallback, useState } from "react";

import { useDailyRecapRepository } from "../../../database/DatabaseProvider";
import { DailyRecap } from "../../../types/recap";

export function useDailyRecap(date: string) {
  const repository = useDailyRecapRepository();
  const [recap, setRecap] = useState<DailyRecap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setRecap(await repository.getDailyRecap(date));
    } catch (error) {
      console.error("Failed to load daily recap", error);
      setErrorMessage("This recap could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [date, repository]);

  return { recap, isLoading, errorMessage, refresh };
}

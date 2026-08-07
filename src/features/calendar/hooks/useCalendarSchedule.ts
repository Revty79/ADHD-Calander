import { useCallback, useMemo, useState } from "react";

import {
  useCalendarEventRepository,
  useTaskRepository
} from "../../../database/DatabaseProvider";
import { LocalDateString } from "../../../types/dateTime";
import { buildCalendarSchedule, CalendarDaySchedule } from "../calendarSchedule";

type CalendarScheduleState = {
  days: Map<LocalDateString, CalendarDaySchedule>;
  isLoading: boolean;
  errorMessage: string | null;
};

export function useCalendarSchedule(
  startDate: LocalDateString,
  endDate: LocalDateString
) {
  const taskRepository = useTaskRepository();
  const calendarEventRepository = useCalendarEventRepository();
  const [state, setState] = useState<CalendarScheduleState>({
    days: new Map(),
    isLoading: true,
    errorMessage: null
  });

  const refresh = useCallback(async () => {
    setState((current) => ({
      ...current,
      isLoading: true,
      errorMessage: null
    }));

    try {
      const [events, tasks] = await Promise.all([
        calendarEventRepository.getEventsForRange(startDate, endDate),
        taskRepository.getAllTasks()
      ]);

      setState({
        days: buildCalendarSchedule(startDate, endDate, events, tasks),
        isLoading: false,
        errorMessage: null
      });
    } catch (error) {
      console.error("Calendar schedule loading failed", error);
      setState((current) => ({
        ...current,
        isLoading: false,
        errorMessage: "The calendar could not be loaded. Please try again."
      }));
    }
  }, [calendarEventRepository, endDate, startDate, taskRepository]);

  return useMemo(() => ({ ...state, refresh }), [refresh, state]);
}

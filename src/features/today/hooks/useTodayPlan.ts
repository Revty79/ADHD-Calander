import { useCallback, useState } from "react";

import {
  useCalendarEventRepository,
  useTaskRepository
} from "../../../database/DatabaseProvider";
import { CalendarEventOccurrence } from "../../../types/calendarEvent";
import { LocalDateString } from "../../../types/dateTime";
import { Task } from "../../../types/task";

export function useTodayPlan(date: LocalDateString) {
  const taskRepository = useTaskRepository();
  const calendarEventRepository = useCalendarEventRepository();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fixedEvents, setFixedEvents] = useState<CalendarEventOccurrence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [nextTasks, nextEvents] = await Promise.all([
        taskRepository.getTasksForDate(date),
        calendarEventRepository.getEventsForDate(date)
      ]);
      setTasks(nextTasks);
      setFixedEvents(nextEvents);
    } catch (error) {
      console.error("Failed to load today's plan", error);
      setErrorMessage("Today's plan could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [calendarEventRepository, date, taskRepository]);

  const completeTask = useCallback(
    async (id: string) => {
      try {
        await taskRepository.completeTask(id);
        await refresh();
      } catch (error) {
        console.error("Failed to complete task", error);
        setErrorMessage("The task could not be updated. Please try again.");
      }
    },
    [refresh, taskRepository]
  );

  const undoCompletion = useCallback(
    async (id: string) => {
      try {
        await taskRepository.undoTaskCompletion(id);
        await refresh();
      } catch (error) {
        console.error("Failed to undo task completion", error);
        setErrorMessage("The task could not be updated. Please try again.");
      }
    },
    [refresh, taskRepository]
  );

  const startTask = useCallback(
    async (id: string) => {
      try {
        await taskRepository.startTask(id);
        await refresh();
      } catch (error) {
        console.error("Failed to start task", error);
        setErrorMessage("The task could not be started. Please try again.");
      }
    },
    [refresh, taskRepository]
  );

  const pauseTask = useCallback(
    async (id: string) => {
      try {
        await taskRepository.pauseTask(id);
        await refresh();
      } catch (error) {
        console.error("Failed to pause task", error);
        setErrorMessage("The task could not be paused. Please try again.");
      }
    },
    [refresh, taskRepository]
  );

  return {
    tasks,
    fixedEvents,
    isLoading,
    errorMessage,
    refresh,
    completeTask,
    undoCompletion,
    startTask,
    pauseTask
  };
}

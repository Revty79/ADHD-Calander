import { useCallback, useState } from "react";

import { useTaskRepository } from "../../../database/DatabaseProvider";
import { LocalDateString, Task } from "../../../types/task";

export function useTasksForDate(date: LocalDateString) {
  const repository = useTaskRepository();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setTasks(await repository.getTasksForDate(date));
    } catch (error) {
      console.error("Failed to load tasks for date", error);
      setErrorMessage("Tasks could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [date, repository]);

  const completeTask = useCallback(
    async (id: string) => {
      try {
        await repository.completeTask(id);
        await refresh();
      } catch (error) {
        console.error("Failed to complete task", error);
        setErrorMessage("The task could not be updated. Please try again.");
      }
    },
    [refresh, repository]
  );

  const undoCompletion = useCallback(
    async (id: string) => {
      try {
        await repository.undoTaskCompletion(id);
        await refresh();
      } catch (error) {
        console.error("Failed to undo task completion", error);
        setErrorMessage("The task could not be updated. Please try again.");
      }
    },
    [refresh, repository]
  );

  return {
    tasks,
    isLoading,
    errorMessage,
    refresh,
    completeTask,
    undoCompletion
  };
}

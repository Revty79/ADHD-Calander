import { useCallback, useState } from "react";

import { useTaskRepository } from "../../../database/DatabaseProvider";
import { Task } from "../../../types/task";

export function useTaskDetail(taskId: string) {
  const repository = useTaskRepository();
  const [task, setTask] = useState<Task | null>(null);
  const [parentTask, setParentTask] = useState<Task | null>(null);
  const [childTasks, setChildTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!taskId) {
      setErrorMessage("This task could not be found.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextTask = await repository.getTaskById(taskId);
      const [nextParent, nextChildren] = await Promise.all([
        nextTask.parentTaskId
          ? repository.getTaskById(nextTask.parentTaskId).catch(() => null)
          : Promise.resolve(null),
        repository.getChildTasks(nextTask.id)
      ]);

      setTask(nextTask);
      setParentTask(nextParent);
      setChildTasks(nextChildren);
    } catch (error) {
      console.error("Failed to load task detail", error);
      setErrorMessage("This task could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [repository, taskId]);

  return {
    childTasks,
    errorMessage,
    isLoading,
    parentTask,
    refresh,
    repository,
    task
  };
}

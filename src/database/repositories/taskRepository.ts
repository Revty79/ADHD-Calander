import { CreateTaskInput, Task } from "../../types/task";
import { normalizeLocalDateInput, normalizeOptionalTime } from "../../utils/dates";
import { createTaskId } from "../../utils/ids";
import { TaskStorage } from "../taskStorage";
import { TaskNotFoundError, TaskPersistenceError, TaskValidationError } from "./errors";

type Clock = () => Date;
type IdGenerator = () => string;

export class TaskRepository {
  constructor(
    private readonly storage: TaskStorage,
    private readonly idGenerator: IdGenerator = createTaskId,
    private readonly clock: Clock = () => new Date()
  ) {}

  async createTask(input: CreateTaskInput): Promise<Task> {
    const normalizedInput = normalizeCreateTaskInput(input);
    const timestamp = this.clock().toISOString();
    const task: Task = {
      id: this.idGenerator(),
      title: normalizedInput.title,
      description: normalizedInput.description,
      status: "not_started",
      scheduledDate: normalizedInput.scheduledDate,
      scheduledTime: normalizedInput.scheduledTime,
      estimatedDurationMinutes: normalizedInput.estimatedDurationMinutes,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      deletedAt: null
    };

    try {
      await this.storage.insertTask(task);
    } catch (error) {
      throw new TaskPersistenceError("Unable to save the task.", error);
    }

    return task;
  }

  async getTasksForDate(date: string): Promise<Task[]> {
    const scheduledDate = normalizeLocalDateInput(date);

    if (!scheduledDate) {
      throw new TaskValidationError(
        "Use a scheduled date in YYYY-MM-DD format.",
        "scheduledDate"
      );
    }

    try {
      const tasks = await this.storage.getTasksForDate(scheduledDate);

      return tasks.filter(isVisibleTask).sort(compareTasks);
    } catch (error) {
      throw new TaskPersistenceError(
        "Unable to load tasks for the selected date.",
        error
      );
    }
  }

  async getAllTasks(): Promise<Task[]> {
    try {
      const tasks = await this.storage.getAllTasks();

      return tasks.filter(isVisibleTask).sort(compareTasks);
    } catch (error) {
      throw new TaskPersistenceError("Unable to load tasks.", error);
    }
  }

  async completeTask(id: string): Promise<Task> {
    const timestamp = this.clock().toISOString();

    try {
      const existingTask = await this.storage.getTaskById(id);

      if (!existingTask) {
        throw new TaskNotFoundError();
      }

      const completedTask: Task = {
        ...existingTask,
        status: "completed",
        completedAt: existingTask.completedAt ?? timestamp,
        updatedAt: timestamp
      };

      if (!(await this.storage.updateTask(completedTask))) {
        throw new TaskNotFoundError();
      }

      return completedTask;
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        throw error;
      }

      throw new TaskPersistenceError("Unable to complete the task.", error);
    }
  }

  async undoTaskCompletion(id: string): Promise<Task> {
    const timestamp = this.clock().toISOString();

    try {
      const existingTask = await this.storage.getTaskById(id);

      if (!existingTask) {
        throw new TaskNotFoundError();
      }

      const restoredTask: Task = {
        ...existingTask,
        status: "not_started",
        completedAt: null,
        updatedAt: timestamp
      };

      if (!(await this.storage.updateTask(restoredTask))) {
        throw new TaskNotFoundError();
      }

      return restoredTask;
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        throw error;
      }

      throw new TaskPersistenceError("Unable to undo task completion.", error);
    }
  }
}

function normalizeCreateTaskInput(
  input: CreateTaskInput
): Pick<
  Task,
  "title" | "description" | "scheduledDate" | "scheduledTime" | "estimatedDurationMinutes"
> {
  const title = input.title.trim();

  if (!title) {
    throw new TaskValidationError("Enter a task title.", "title");
  }

  const rawScheduledDate = input.scheduledDate?.trim() ?? "";
  const scheduledDate = rawScheduledDate
    ? normalizeLocalDateInput(rawScheduledDate)
    : null;

  if (rawScheduledDate && !scheduledDate) {
    throw new TaskValidationError(
      "Use a scheduled date in YYYY-MM-DD format.",
      "scheduledDate"
    );
  }

  const rawScheduledTime = input.scheduledTime?.trim() ?? "";
  const scheduledTime = normalizeOptionalTime(rawScheduledTime);

  if (rawScheduledTime && !scheduledTime) {
    throw new TaskValidationError(
      "Use a scheduled time in HH:MM format.",
      "scheduledTime"
    );
  }

  if (scheduledTime && !scheduledDate) {
    throw new TaskValidationError(
      "Choose a scheduled date before adding a time.",
      "scheduledDate"
    );
  }

  const estimatedDurationMinutes = input.estimatedDurationMinutes ?? null;

  if (
    estimatedDurationMinutes !== null &&
    (!Number.isInteger(estimatedDurationMinutes) || estimatedDurationMinutes <= 0)
  ) {
    throw new TaskValidationError(
      "Estimate must be a whole number of minutes greater than zero.",
      "estimatedDurationMinutes"
    );
  }

  const description = input.description?.trim() || null;

  return {
    title,
    description,
    scheduledDate,
    scheduledTime,
    estimatedDurationMinutes
  };
}

function isVisibleTask(task: Task): boolean {
  return task.deletedAt === null;
}

function compareTasks(first: Task, second: Task): number {
  if (first.scheduledDate === null && second.scheduledDate !== null) {
    return 1;
  }

  if (first.scheduledDate !== null && second.scheduledDate === null) {
    return -1;
  }

  const dateOrder = (first.scheduledDate ?? "").localeCompare(second.scheduledDate ?? "");

  if (dateOrder !== 0) {
    return dateOrder;
  }

  const firstCompleted = first.status === "completed" ? 1 : 0;
  const secondCompleted = second.status === "completed" ? 1 : 0;

  if (firstCompleted !== secondCompleted) {
    return firstCompleted - secondCompleted;
  }

  if (first.scheduledTime === null && second.scheduledTime !== null) {
    return 1;
  }

  if (first.scheduledTime !== null && second.scheduledTime === null) {
    return -1;
  }

  const timeOrder = (first.scheduledTime ?? "").localeCompare(second.scheduledTime ?? "");

  if (timeOrder !== 0) {
    return timeOrder;
  }

  return first.createdAt.localeCompare(second.createdAt);
}

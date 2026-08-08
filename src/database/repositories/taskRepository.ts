import { CreateTaskInput, isTaskActive, ScheduleTaskInput, Task } from "../../types/task";
import {
  getReminderTriggerDate,
  isReminderOffsetMinutes
} from "../../notifications/reminderRules";
import {
  noOpReminderSynchronizer,
  ReminderSynchronizer
} from "../../notifications/reminderSynchronizer";
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
    private readonly clock: Clock = () => new Date(),
    private readonly reminderSynchronizer: ReminderSynchronizer = noOpReminderSynchronizer
  ) {}

  async createTask(input: CreateTaskInput): Promise<Task> {
    const normalizedInput = normalizeCreateTaskInput(input);
    const now = this.clock();
    const timestamp = now.toISOString();

    if (normalizedInput.reminderOffsetMinutes !== null) {
      const reminderDate = getReminderTriggerDate(
        normalizedInput.scheduledDate!,
        normalizedInput.scheduledTime!,
        normalizedInput.reminderOffsetMinutes
      );

      if (!reminderDate || reminderDate.getTime() <= now.getTime()) {
        throw new TaskValidationError(
          "Choose a future date and time for this reminder.",
          "reminderOffsetMinutes"
        );
      }
    }

    const task: Task = {
      id: this.idGenerator(),
      title: normalizedInput.title,
      description: normalizedInput.description,
      status: "not_started",
      scheduledDate: normalizedInput.scheduledDate,
      scheduledTime: normalizedInput.scheduledTime,
      estimatedDurationMinutes: normalizedInput.estimatedDurationMinutes,
      deadlineDate: normalizedInput.deadlineDate,
      reminderOffsetMinutes: normalizedInput.reminderOffsetMinutes,
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

    await this.reminderSynchronizer.syncTaskReminder(task);

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

  async getTaskById(id: string): Promise<Task> {
    try {
      const task = await this.storage.getTaskById(id);

      if (!task || !isVisibleTask(task)) {
        throw new TaskNotFoundError();
      }

      return task;
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        throw error;
      }

      throw new TaskPersistenceError("Unable to load the task.", error);
    }
  }

  async scheduleTask(id: string, input: ScheduleTaskInput): Promise<Task> {
    const normalizedInput = normalizeScheduleTaskInput(input);
    const now = this.clock();
    const scheduledDateTime = getReminderTriggerDate(
      normalizedInput.scheduledDate,
      normalizedInput.scheduledTime,
      0
    );

    if (!scheduledDateTime || scheduledDateTime.getTime() <= now.getTime()) {
      throw new TaskValidationError(
        "Choose a future time for this task.",
        "scheduledTime"
      );
    }

    try {
      const existingTask = await this.storage.getTaskById(id);

      if (!existingTask) {
        throw new TaskNotFoundError();
      }

      if (!isTaskActive(existingTask)) {
        throw new TaskValidationError(
          "Only an active task can be scheduled.",
          "scheduledDate"
        );
      }

      if (
        existingTask.deadlineDate !== null &&
        normalizedInput.scheduledDate > existingTask.deadlineDate
      ) {
        throw new TaskValidationError(
          "Choose a time on or before this task's deadline.",
          "deadlineDate"
        );
      }

      let reminderOffsetMinutes = existingTask.reminderOffsetMinutes;

      if (reminderOffsetMinutes !== null) {
        const reminderDate = getReminderTriggerDate(
          normalizedInput.scheduledDate,
          normalizedInput.scheduledTime,
          reminderOffsetMinutes
        );

        if (!reminderDate || reminderDate.getTime() <= now.getTime()) {
          reminderOffsetMinutes = null;
        }
      }

      const scheduledTask: Task = {
        ...existingTask,
        scheduledDate: normalizedInput.scheduledDate,
        scheduledTime: normalizedInput.scheduledTime,
        estimatedDurationMinutes:
          normalizedInput.estimatedDurationMinutes ??
          existingTask.estimatedDurationMinutes,
        reminderOffsetMinutes,
        updatedAt: now.toISOString()
      };

      if (!(await this.storage.updateTask(scheduledTask))) {
        throw new TaskNotFoundError();
      }

      await this.reminderSynchronizer.syncTaskReminder(scheduledTask);

      return scheduledTask;
    } catch (error) {
      if (error instanceof TaskNotFoundError || error instanceof TaskValidationError) {
        throw error;
      }

      throw new TaskPersistenceError("Unable to schedule the task.", error);
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
        reminderOffsetMinutes: null,
        completedAt: existingTask.completedAt ?? timestamp,
        updatedAt: timestamp
      };

      if (!(await this.storage.updateTask(completedTask))) {
        throw new TaskNotFoundError();
      }

      await this.reminderSynchronizer.syncTaskReminder(completedTask);

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
  | "title"
  | "description"
  | "scheduledDate"
  | "scheduledTime"
  | "estimatedDurationMinutes"
  | "deadlineDate"
  | "reminderOffsetMinutes"
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
  const rawDeadlineDate = input.deadlineDate?.trim() ?? "";
  const deadlineDate = rawDeadlineDate ? normalizeLocalDateInput(rawDeadlineDate) : null;

  if (rawDeadlineDate && !deadlineDate) {
    throw new TaskValidationError("Use a deadline in YYYY-MM-DD format.", "deadlineDate");
  }

  if (scheduledDate && deadlineDate && scheduledDate > deadlineDate) {
    throw new TaskValidationError(
      "Choose a deadline on or after the scheduled date.",
      "deadlineDate"
    );
  }

  const reminderOffsetMinutes = input.reminderOffsetMinutes ?? null;

  if (reminderOffsetMinutes !== null && !isReminderOffsetMinutes(reminderOffsetMinutes)) {
    throw new TaskValidationError(
      "Choose an available reminder time.",
      "reminderOffsetMinutes"
    );
  }

  if (reminderOffsetMinutes !== null && (!scheduledDate || !scheduledTime)) {
    throw new TaskValidationError(
      "Choose a scheduled date and time before adding a reminder.",
      "reminderOffsetMinutes"
    );
  }

  return {
    title,
    description,
    scheduledDate,
    scheduledTime,
    estimatedDurationMinutes,
    deadlineDate,
    reminderOffsetMinutes
  };
}

function normalizeScheduleTaskInput(input: ScheduleTaskInput): {
  scheduledDate: Task["scheduledDate"] & string;
  scheduledTime: Task["scheduledTime"] & string;
  estimatedDurationMinutes: number | undefined;
} {
  const scheduledDate = normalizeLocalDateInput(input.scheduledDate);

  if (!scheduledDate) {
    throw new TaskValidationError(
      "Use a scheduled date in YYYY-MM-DD format.",
      "scheduledDate"
    );
  }

  const scheduledTime = normalizeOptionalTime(input.scheduledTime);

  if (!scheduledTime) {
    throw new TaskValidationError(
      "Use a scheduled time in HH:MM format.",
      "scheduledTime"
    );
  }

  if (
    input.estimatedDurationMinutes !== undefined &&
    (!Number.isInteger(input.estimatedDurationMinutes) ||
      input.estimatedDurationMinutes <= 0)
  ) {
    throw new TaskValidationError(
      "Estimate must be a whole number of minutes greater than zero.",
      "estimatedDurationMinutes"
    );
  }

  return {
    scheduledDate,
    scheduledTime,
    estimatedDurationMinutes: input.estimatedDurationMinutes
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

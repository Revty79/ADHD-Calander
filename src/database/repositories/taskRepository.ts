import {
  BreakDownTaskInput,
  CreateTaskInput,
  isPlannedTimePreference,
  isTaskActive,
  ScheduleTaskInput,
  taskImportances,
  Task,
  TaskImportance,
  UpdateTaskInput
} from "../../types/task";
import { getReminderTriggerDate } from "../../notifications/reminderRules";
import {
  isReminderOffsetList,
  normalizeReminderOffsets
} from "../../notifications/reminderOffsets";
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

type NormalizedTaskInput = Pick<
  Task,
  | "title"
  | "description"
  | "importance"
  | "scheduledDate"
  | "scheduledTime"
  | "plannedTimePreference"
  | "estimatedDurationMinutes"
  | "deadlineDate"
  | "reminderOffsets"
>;

export class TaskRepository {
  constructor(
    private readonly storage: TaskStorage,
    private readonly idGenerator: IdGenerator = createTaskId,
    private readonly clock: Clock = () => new Date(),
    private readonly reminderSynchronizer: ReminderSynchronizer = noOpReminderSynchronizer
  ) {}

  async createTask(input: CreateTaskInput): Promise<Task> {
    const normalizedInput = normalizeTaskInput(input);
    const now = this.clock();
    const timestamp = now.toISOString();

    const task: Task = {
      id: this.idGenerator(),
      title: normalizedInput.title,
      description: normalizedInput.description,
      importance: normalizedInput.importance,
      status: "not_started",
      parentTaskId: null,
      scheduledDate: normalizedInput.scheduledDate,
      scheduledTime: normalizedInput.scheduledTime,
      plannedTimePreference: normalizedInput.plannedTimePreference,
      estimatedDurationMinutes: normalizedInput.estimatedDurationMinutes,
      deadlineDate: normalizedInput.deadlineDate,
      reminderOffsets: normalizedInput.reminderOffsets,
      startedAt: null,
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

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    const normalizedInput = normalizeTaskInput(input);
    const now = this.clock();

    try {
      const existingTask = await this.requireStoredTask(id);
      const updatedTask: Task = {
        ...existingTask,
        ...normalizedInput,
        updatedAt: now.toISOString()
      };

      if (!(await this.storage.updateTask(updatedTask))) {
        throw new TaskNotFoundError();
      }

      await this.reminderSynchronizer.syncTaskReminder(updatedTask);

      return updatedTask;
    } catch (error) {
      throw wrapTaskError("Unable to update the task.", error);
    }
  }

  async getTasksForDate(date: string): Promise<Task[]> {
    const scheduledDate = normalizeLocalDateInput(date);

    if (!scheduledDate) {
      throw new TaskValidationError(
        "Use a planned date in YYYY-MM-DD format.",
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
      const task = await this.requireStoredTask(id);

      if (!isVisibleTask(task)) {
        throw new TaskNotFoundError();
      }

      return task;
    } catch (error) {
      throw wrapTaskError("Unable to load the task.", error);
    }
  }

  async getChildTasks(parentTaskId: string): Promise<Task[]> {
    try {
      const tasks = await this.storage.getChildTasks(parentTaskId);

      return tasks.filter(isVisibleTask).sort(compareTasks);
    } catch (error) {
      throw new TaskPersistenceError("Unable to load the smaller tasks.", error);
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
      const existingTask = await this.requireStoredTask(id);

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

      const scheduledTask: Task = {
        ...existingTask,
        scheduledDate: normalizedInput.scheduledDate,
        scheduledTime: normalizedInput.scheduledTime,
        plannedTimePreference: existingTask.plannedTimePreference ?? "anytime",
        estimatedDurationMinutes:
          normalizedInput.estimatedDurationMinutes ??
          existingTask.estimatedDurationMinutes,
        reminderOffsets: normalizedInput.reminderOffsets ?? existingTask.reminderOffsets,
        updatedAt: now.toISOString()
      };

      if (!(await this.storage.updateTask(scheduledTask))) {
        throw new TaskNotFoundError();
      }

      await this.reminderSynchronizer.syncTaskReminder(scheduledTask);

      return scheduledTask;
    } catch (error) {
      throw wrapTaskError("Unable to schedule the task.", error);
    }
  }

  async breakDownTask(id: string, input: BreakDownTaskInput): Promise<Task[]> {
    const titles = normalizeBreakdownTitles(input.titles);
    const timestamp = this.clock().toISOString();

    try {
      const parentTask = await this.requireStoredTask(id);

      if (!isTaskActive(parentTask)) {
        throw new TaskValidationError(
          "Only an active task can be broken into smaller tasks.",
          "breakdownTitles"
        );
      }

      const resolvedParent: Task = {
        ...parentTask,
        status: "broken_down",
        updatedAt: timestamp
      };
      const childTasks = titles.map<Task>((title) => ({
        id: this.idGenerator(),
        title,
        description: null,
        importance: "normal",
        status: "not_started",
        parentTaskId: parentTask.id,
        scheduledDate: null,
        scheduledTime: null,
        plannedTimePreference: null,
        estimatedDurationMinutes: null,
        deadlineDate: null,
        reminderOffsets: [],
        startedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt: null,
        deletedAt: null
      }));

      await this.storage.saveTaskGroup([resolvedParent], childTasks);
      await this.reminderSynchronizer.syncTaskReminder(resolvedParent);

      return childTasks;
    } catch (error) {
      throw wrapTaskError("Unable to create the smaller tasks.", error);
    }
  }

  async undoTaskBreakdown(id: string): Promise<Task> {
    const timestamp = this.clock().toISOString();

    try {
      const parentTask = await this.requireStoredTask(id);

      if (parentTask.status !== "broken_down") {
        throw new TaskValidationError(
          "This task is not currently broken into smaller tasks.",
          "breakdownTitles"
        );
      }

      const childTasks = await this.storage.getChildTasks(id);

      if (
        childTasks.some(
          (task) => task.status !== "not_started" && task.status !== "removed"
        )
      ) {
        throw new TaskValidationError(
          "A smaller task already has progress, so this breakdown cannot be undone.",
          "breakdownTitles"
        );
      }

      const restoredParent: Task = {
        ...parentTask,
        status: "not_started",
        updatedAt: timestamp
      };
      const removedChildren = childTasks.map<Task>((task) => ({
        ...task,
        status: "removed",
        updatedAt: timestamp
      }));

      await this.storage.saveTaskGroup([restoredParent, ...removedChildren], []);
      await Promise.all(
        removedChildren.map((task) => this.reminderSynchronizer.syncTaskReminder(task))
      );

      return restoredParent;
    } catch (error) {
      throw wrapTaskError("Unable to undo the task breakdown.", error);
    }
  }

  async completeTask(id: string): Promise<Task> {
    const timestamp = this.clock().toISOString();

    try {
      const existingTask = await this.requireStoredTask(id);

      if (!isTaskActive(existingTask)) {
        throw new TaskValidationError("Only an active task can be completed.", "title");
      }

      const completedTask: Task = {
        ...existingTask,
        status: "completed",
        completedAt: timestamp,
        updatedAt: timestamp
      };

      if (!(await this.storage.updateTask(completedTask))) {
        throw new TaskNotFoundError();
      }

      await this.reminderSynchronizer.syncTaskReminder(completedTask);

      return completedTask;
    } catch (error) {
      throw wrapTaskError("Unable to complete the task.", error);
    }
  }

  async undoTaskCompletion(id: string): Promise<Task> {
    const timestamp = this.clock().toISOString();

    try {
      const existingTask = await this.requireStoredTask(id);

      if (existingTask.status !== "completed") {
        throw new TaskValidationError(
          "Only a completed task can have completion undone.",
          "title"
        );
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
      throw wrapTaskError("Unable to undo task completion.", error);
    }
  }

  async startTask(id: string): Promise<Task> {
    const timestamp = this.clock().toISOString();

    try {
      const existingTask = await this.requireStoredTask(id);

      if (existingTask.status !== "not_started") {
        throw new TaskValidationError(
          "Only a task that is not started can be started.",
          "title"
        );
      }

      const startedTask: Task = {
        ...existingTask,
        status: "started",
        startedAt: timestamp,
        updatedAt: timestamp
      };

      if (!(await this.storage.updateTask(startedTask))) {
        throw new TaskNotFoundError();
      }

      return startedTask;
    } catch (error) {
      throw wrapTaskError("Unable to start the task.", error);
    }
  }

  async pauseTask(id: string): Promise<Task> {
    const timestamp = this.clock().toISOString();

    try {
      const existingTask = await this.requireStoredTask(id);

      if (existingTask.status !== "started") {
        throw new TaskValidationError("Only an in-progress task can be paused.", "title");
      }

      const pausedTask: Task = {
        ...existingTask,
        status: "not_started",
        updatedAt: timestamp
      };

      if (!(await this.storage.updateTask(pausedTask))) {
        throw new TaskNotFoundError();
      }

      return pausedTask;
    } catch (error) {
      throw wrapTaskError("Unable to pause the task.", error);
    }
  }

  async removeTask(id: string): Promise<Task> {
    return this.changeResolutionStatus(
      id,
      "removed",
      "Only an active task can be removed from active tasks.",
      "Unable to remove the task from active tasks."
    );
  }

  async restoreTask(id: string): Promise<Task> {
    const timestamp = this.clock().toISOString();

    try {
      const existingTask = await this.requireStoredTask(id);

      if (existingTask.status !== "removed") {
        throw new TaskValidationError("Only a removed task can be restored.", "title");
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
      throw wrapTaskError("Unable to restore the task.", error);
    }
  }

  private async changeResolutionStatus(
    id: string,
    status: "removed",
    validationMessage: string,
    persistenceMessage: string
  ): Promise<Task> {
    const timestamp = this.clock().toISOString();

    try {
      const existingTask = await this.requireStoredTask(id);

      if (!isTaskActive(existingTask)) {
        throw new TaskValidationError(validationMessage, "title");
      }

      const updatedTask: Task = {
        ...existingTask,
        status,
        updatedAt: timestamp
      };

      if (!(await this.storage.updateTask(updatedTask))) {
        throw new TaskNotFoundError();
      }

      await this.reminderSynchronizer.syncTaskReminder(updatedTask);

      return updatedTask;
    } catch (error) {
      throw wrapTaskError(persistenceMessage, error);
    }
  }

  private async requireStoredTask(id: string): Promise<Task> {
    const task = await this.storage.getTaskById(id);

    if (!task) {
      throw new TaskNotFoundError();
    }

    return task;
  }
}

function normalizeTaskInput(
  input: CreateTaskInput | UpdateTaskInput
): NormalizedTaskInput {
  const title = input.title.trim();

  if (!title) {
    throw new TaskValidationError("Enter a task title.", "title");
  }

  const importance = input.importance ?? "normal";

  if (!taskImportances.some((candidate) => candidate === importance)) {
    throw new TaskValidationError("Choose an available importance.", "importance");
  }

  const rawScheduledDate = input.scheduledDate?.trim() ?? "";
  const scheduledDate = rawScheduledDate
    ? normalizeLocalDateInput(rawScheduledDate)
    : null;

  if (rawScheduledDate && !scheduledDate) {
    throw new TaskValidationError(
      "Use a planned date in YYYY-MM-DD format.",
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
      "Choose a planned date before adding a time.",
      "scheduledDate"
    );
  }

  const rawPlannedTimePreference = input.plannedTimePreference?.trim() ?? "";
  let plannedTimePreference: Task["plannedTimePreference"] = null;

  if (scheduledDate !== null) {
    const candidate = rawPlannedTimePreference || "anytime";

    if (!isPlannedTimePreference(candidate)) {
      throw new TaskValidationError(
        "Choose Anytime, Morning, Afternoon, or Evening.",
        "plannedTimePreference"
      );
    }

    plannedTimePreference = candidate;
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
      "Choose a deadline on or after the planned date.",
      "deadlineDate"
    );
  }

  const reminderOffsets = input.reminderOffsets ?? [];

  if (!isReminderOffsetList(reminderOffsets)) {
    throw new TaskValidationError(
      "Choose up to five different reminder times.",
      "reminderOffsets"
    );
  }

  return {
    title,
    description,
    importance,
    scheduledDate,
    scheduledTime,
    plannedTimePreference,
    estimatedDurationMinutes,
    deadlineDate,
    reminderOffsets: normalizeReminderOffsets(reminderOffsets)
  };
}

function normalizeScheduleTaskInput(input: ScheduleTaskInput): {
  scheduledDate: Task["scheduledDate"] & string;
  scheduledTime: Task["scheduledTime"] & string;
  estimatedDurationMinutes: number | undefined;
  reminderOffsets: Task["reminderOffsets"] | undefined;
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

  if (
    input.reminderOffsets !== undefined &&
    !isReminderOffsetList(input.reminderOffsets)
  ) {
    throw new TaskValidationError(
      "Choose up to five different reminder times.",
      "reminderOffsets"
    );
  }

  return {
    scheduledDate,
    scheduledTime,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    reminderOffsets:
      input.reminderOffsets === undefined
        ? undefined
        : normalizeReminderOffsets(input.reminderOffsets)
  };
}

function normalizeBreakdownTitles(titles: string[]): string[] {
  const normalizedTitles = titles.map((title) => title.trim());

  if (
    normalizedTitles.length < 2 ||
    normalizedTitles.length > 20 ||
    normalizedTitles.some((title) => !title)
  ) {
    throw new TaskValidationError(
      "Add between 2 and 20 clear smaller-task titles.",
      "breakdownTitles"
    );
  }

  const uniqueTitles = new Set(normalizedTitles.map((title) => title.toLowerCase()));

  if (uniqueTitles.size !== normalizedTitles.length) {
    throw new TaskValidationError(
      "Give each smaller task a different title.",
      "breakdownTitles"
    );
  }

  return normalizedTitles;
}

function wrapTaskError(message: string, error: unknown): Error {
  if (error instanceof TaskNotFoundError || error instanceof TaskValidationError) {
    return error;
  }

  return new TaskPersistenceError(message, error);
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

  const importanceOrder: Record<TaskImportance, number> = {
    important: 0,
    normal: 1,
    low: 2
  };
  const priorityOrder =
    importanceOrder[first.importance] - importanceOrder[second.importance];

  if (priorityOrder !== 0) {
    return priorityOrder;
  }

  return first.createdAt.localeCompare(second.createdAt);
}

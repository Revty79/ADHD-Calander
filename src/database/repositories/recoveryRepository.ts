import {
  BreakDownRecoveryInput,
  DelegateRecoveryInput,
  RecoveryDecisionType,
  RecoveryItem,
  RecoverySession,
  RescheduleRecoveryInput
} from "../../types/recovery";
import { LocalDateString } from "../../types/dateTime";
import { isTaskActive, isTaskCompleted, Task } from "../../types/task";
import {
  noOpReminderSynchronizer,
  ReminderSynchronizer
} from "../../notifications/reminderSynchronizer";
import { normalizeLocalDateInput, normalizeOptionalTime } from "../../utils/dates";
import {
  createRecoveryItemId,
  createRecoverySessionId,
  createTaskId
} from "../../utils/ids";
import { RecoveryStorage } from "../recoveryStorage";
import { TaskStorage } from "../taskStorage";
import {
  RecoveryItemNotFoundError,
  RecoveryPersistenceError,
  RecoveryValidationError
} from "./recoveryErrors";

type Clock = () => Date;
type IdGenerator = () => string;

export class RecoveryRepository {
  constructor(
    private readonly recoveryStorage: RecoveryStorage,
    private readonly taskStorage: TaskStorage,
    private readonly sessionIdGenerator: IdGenerator = createRecoverySessionId,
    private readonly itemIdGenerator: IdGenerator = createRecoveryItemId,
    private readonly taskIdGenerator: IdGenerator = createTaskId,
    private readonly clock: Clock = () => new Date(),
    private readonly reminderSynchronizer: ReminderSynchronizer = noOpReminderSynchronizer
  ) {}

  async startSession(sourceDateInput: string): Promise<RecoverySession> {
    const sourceDate = requireLocalDate(sourceDateInput, "sourceDate");

    try {
      const activeSession = await this.recoveryStorage.getActiveSession();

      if (activeSession) {
        return activeSession;
      }

      const timestamp = this.clock().toISOString();
      const tasks = await this.taskStorage.getTasksForDate(sourceDate);
      const items = tasks
        .filter(isTaskActive)
        .map((task) =>
          createRecoveryItem(this.itemIdGenerator(), "", task, sourceDate, timestamp)
        );
      const sessionId = this.sessionIdGenerator();
      const session: RecoverySession = {
        id: sessionId,
        sourceDate,
        status: "active",
        startedAt: timestamp,
        completedAt: null,
        items: items.map((item) => ({ ...item, sessionId }))
      };

      await this.recoveryStorage.insertSession(session);

      return session;
    } catch (error) {
      throw wrapRecoveryError("Unable to start Recovery Mode.", error);
    }
  }

  async getActiveSession(): Promise<RecoverySession | null> {
    try {
      return await this.recoveryStorage.getActiveSession();
    } catch (error) {
      throw new RecoveryPersistenceError(
        "Unable to load the active recovery session.",
        error
      );
    }
  }

  async getLatestCompletedSession(): Promise<RecoverySession | null> {
    try {
      return await this.recoveryStorage.getLatestCompletedSession();
    } catch (error) {
      throw new RecoveryPersistenceError("Unable to load recovery history.", error);
    }
  }

  async getSessionsForDate(sourceDateInput: string): Promise<RecoverySession[]> {
    const sourceDate = requireLocalDate(sourceDateInput, "sourceDate");

    try {
      return await this.recoveryStorage.getSessionsForDate(sourceDate);
    } catch (error) {
      throw new RecoveryPersistenceError(
        "Unable to load recovery history for the selected date.",
        error
      );
    }
  }

  async keepTask(itemId: string): Promise<RecoverySession> {
    return this.applyFinalDecision(itemId, "keep", (task, item, timestamp) => ({
      item: resolveItem(item, "keep", timestamp),
      updatedTasks: [
        {
          ...task,
          scheduledDate: null,
          scheduledTime: null,
          reminderOffsetMinutes: null,
          updatedAt: timestamp
        }
      ],
      createdTasks: []
    }));
  }

  async rescheduleTask(
    itemId: string,
    input: RescheduleRecoveryInput
  ): Promise<RecoverySession> {
    const scheduledDate = requireLocalDate(input.scheduledDate, "scheduledDate");
    const rawScheduledTime = input.scheduledTime?.trim() ?? "";
    const scheduledTime = normalizeOptionalTime(rawScheduledTime);

    if (rawScheduledTime && !scheduledTime) {
      throw new RecoveryValidationError(
        "Use a scheduled time in HH:MM format.",
        "scheduledTime"
      );
    }

    return this.applyFinalDecision(itemId, "reschedule", (task, item, timestamp) => ({
      item: resolveItem(item, "reschedule", timestamp, {
        rescheduledDate: scheduledDate,
        rescheduledTime: scheduledTime
      }),
      updatedTasks: [
        {
          ...task,
          scheduledDate,
          scheduledTime,
          reminderOffsetMinutes: scheduledTime ? task.reminderOffsetMinutes : null,
          updatedAt: timestamp
        }
      ],
      createdTasks: []
    }));
  }

  async breakDownTask(
    itemId: string,
    input: BreakDownRecoveryInput
  ): Promise<RecoverySession> {
    const titles = normalizeBreakdownTitles(input.titles);

    return this.applyFinalDecision(itemId, "break_down", (task, item, timestamp) => {
      const createdTasks = titles.map((title) =>
        createUnscheduledTask(this.taskIdGenerator(), title, timestamp)
      );

      return {
        item: resolveItem(item, "break_down", timestamp, {
          createdTaskIds: createdTasks.map((createdTask) => createdTask.id)
        }),
        updatedTasks: [
          {
            ...task,
            status: "broken_down",
            reminderOffsetMinutes: null,
            updatedAt: timestamp
          }
        ],
        createdTasks
      };
    });
  }

  async delegateTask(
    itemId: string,
    input: DelegateRecoveryInput = {}
  ): Promise<RecoverySession> {
    const note = input.note?.trim() || null;

    return this.applyFinalDecision(itemId, "delegate", (task, item, timestamp) => ({
      item: resolveItem(item, "delegate", timestamp, { note }),
      updatedTasks: [
        {
          ...task,
          status: "delegated",
          reminderOffsetMinutes: null,
          updatedAt: timestamp
        }
      ],
      createdTasks: []
    }));
  }

  async removeTask(itemId: string): Promise<RecoverySession> {
    return this.applyFinalDecision(itemId, "remove", (task, item, timestamp) => ({
      item: resolveItem(item, "remove", timestamp),
      updatedTasks: [
        {
          ...task,
          status: "removed",
          reminderOffsetMinutes: null,
          updatedAt: timestamp
        }
      ],
      createdTasks: []
    }));
  }

  async skipTask(itemId: string): Promise<RecoverySession> {
    try {
      const { item } = await this.getDecisionContext(itemId);
      const timestamp = this.clock().toISOString();

      await this.recoveryStorage.saveDecision({
        item: {
          ...item,
          status: "pending",
          decision: "skip",
          reviewedAt: timestamp,
          updatedAt: timestamp
        },
        updatedTasks: [],
        createdTasks: []
      });

      return await this.requireActiveSession();
    } catch (error) {
      throw wrapRecoveryError("Unable to save this recovery decision.", error);
    }
  }

  async reopenItem(itemId: string): Promise<RecoverySession> {
    try {
      const session = await this.requireActiveSession();
      const item = session.items.find((candidate) => candidate.id === itemId);

      if (!item || item.status !== "resolved") {
        throw new RecoveryItemNotFoundError();
      }

      const originalTask = await this.requireTask(item.taskId);

      if (isTaskCompleted(originalTask)) {
        throw new RecoveryValidationError(
          "This task was completed after the decision and cannot be reopened here.",
          "session"
        );
      }

      const createdTasks = await Promise.all(
        item.createdTaskIds.map((taskId) => this.requireTask(taskId))
      );

      if (createdTasks.some(isTaskCompleted)) {
        throw new RecoveryValidationError(
          "A smaller task was completed, so this decision cannot be changed here.",
          "session"
        );
      }

      const timestamp = this.clock().toISOString();
      const restoredOriginalTask: Task = {
        ...originalTask,
        status: item.originalStatus,
        scheduledDate: item.originalScheduledDate,
        scheduledTime: item.originalScheduledTime,
        reminderOffsetMinutes: item.originalReminderOffsetMinutes,
        completedAt: null,
        updatedAt: timestamp
      };
      const retiredCreatedTasks = createdTasks.map<Task>((task) => ({
        ...task,
        status: "removed",
        reminderOffsetMinutes: null,
        updatedAt: timestamp
      }));

      await this.recoveryStorage.saveDecision({
        item: {
          ...item,
          status: "pending",
          decision: null,
          note: null,
          rescheduledDate: null,
          rescheduledTime: null,
          createdTaskIds: [],
          reviewedAt: null,
          updatedAt: timestamp
        },
        updatedTasks: [restoredOriginalTask, ...retiredCreatedTasks],
        createdTasks: []
      });
      await this.syncTaskReminders([restoredOriginalTask, ...retiredCreatedTasks]);

      return await this.requireActiveSession();
    } catch (error) {
      throw wrapRecoveryError("Unable to change this recovery decision.", error);
    }
  }

  async completeSession(): Promise<RecoverySession> {
    try {
      const session = await this.requireActiveSession();

      if (session.items.some((item) => item.status !== "resolved")) {
        throw new RecoveryValidationError(
          "Choose what happens to each task before finishing Recovery Mode.",
          "session"
        );
      }

      const completedSession: RecoverySession = {
        ...session,
        status: "completed",
        completedAt: this.clock().toISOString()
      };

      await this.recoveryStorage.updateSession(completedSession);

      return completedSession;
    } catch (error) {
      throw wrapRecoveryError("Unable to finish Recovery Mode.", error);
    }
  }

  private async applyFinalDecision(
    itemId: string,
    decision: Exclude<RecoveryDecisionType, "skip">,
    buildMutation: (
      task: Task,
      item: RecoveryItem,
      timestamp: string
    ) => {
      item: RecoveryItem;
      updatedTasks: Task[];
      createdTasks: Task[];
    }
  ): Promise<RecoverySession> {
    try {
      const { item, task } = await this.getDecisionContext(itemId);
      const timestamp = this.clock().toISOString();
      const mutation = buildMutation(task, item, timestamp);

      if (mutation.item.decision !== decision) {
        throw new Error("Recovery decision mutation did not match its action.");
      }

      await this.recoveryStorage.saveDecision(mutation);
      await this.syncTaskReminders([...mutation.updatedTasks, ...mutation.createdTasks]);

      return await this.requireActiveSession();
    } catch (error) {
      throw wrapRecoveryError("Unable to save this recovery decision.", error);
    }
  }

  private async getDecisionContext(itemId: string): Promise<{
    item: RecoveryItem;
    task: Task;
  }> {
    const session = await this.requireActiveSession();
    const item = session.items.find((candidate) => candidate.id === itemId);

    if (!item || item.status !== "pending") {
      throw new RecoveryItemNotFoundError();
    }

    const task = await this.requireTask(item.taskId);

    if (!isTaskActive(task)) {
      throw new RecoveryValidationError(
        "This task changed after Recovery Mode started. Refresh before continuing.",
        "session"
      );
    }

    return { item, task };
  }

  private async requireActiveSession(): Promise<RecoverySession> {
    const session = await this.recoveryStorage.getActiveSession();

    if (!session) {
      throw new RecoveryValidationError(
        "Start Recovery Mode before making a decision.",
        "session"
      );
    }

    return session;
  }

  private async requireTask(taskId: string): Promise<Task> {
    const task = await this.taskStorage.getTaskById(taskId);

    if (!task) {
      throw new RecoveryItemNotFoundError(
        "The task for this recovery item was not found."
      );
    }

    return task;
  }

  private async syncTaskReminders(tasks: Task[]): Promise<void> {
    await Promise.all(
      tasks.map((task) => this.reminderSynchronizer.syncTaskReminder(task))
    );
  }
}

function createRecoveryItem(
  id: string,
  sessionId: string,
  task: Task,
  sourceDate: LocalDateString,
  timestamp: string
): RecoveryItem {
  return {
    id,
    sessionId,
    taskId: task.id,
    originalTitle: task.title,
    originalStatus: task.status,
    originalScheduledDate: sourceDate,
    originalScheduledTime: task.scheduledTime,
    originalEstimatedDurationMinutes: task.estimatedDurationMinutes,
    originalReminderOffsetMinutes: task.reminderOffsetMinutes,
    status: "pending",
    decision: null,
    note: null,
    rescheduledDate: null,
    rescheduledTime: null,
    createdTaskIds: [],
    reviewedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createUnscheduledTask(id: string, title: string, timestamp: string): Task {
  return {
    id,
    title,
    description: null,
    status: "not_started",
    scheduledDate: null,
    scheduledTime: null,
    estimatedDurationMinutes: null,
    deadlineDate: null,
    reminderOffsetMinutes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    deletedAt: null
  };
}

function resolveItem(
  item: RecoveryItem,
  decision: Exclude<RecoveryDecisionType, "skip">,
  timestamp: string,
  changes: Partial<
    Pick<RecoveryItem, "note" | "rescheduledDate" | "rescheduledTime" | "createdTaskIds">
  > = {}
): RecoveryItem {
  return {
    ...item,
    status: "resolved",
    decision,
    note: null,
    rescheduledDate: null,
    rescheduledTime: null,
    createdTaskIds: [],
    reviewedAt: timestamp,
    updatedAt: timestamp,
    ...changes
  };
}

function requireLocalDate(
  value: string,
  field: "sourceDate" | "scheduledDate"
): LocalDateString {
  const normalizedDate = normalizeLocalDateInput(value);

  if (!normalizedDate) {
    throw new RecoveryValidationError("Use a date in YYYY-MM-DD format.", field);
  }

  return normalizedDate;
}

function normalizeBreakdownTitles(titles: string[]): string[] {
  const normalizedTitles = titles.map((title) => title.trim()).filter(Boolean);

  if (normalizedTitles.length < 2) {
    throw new RecoveryValidationError(
      "Enter at least two smaller task titles.",
      "breakdownTitles"
    );
  }

  if (new Set(normalizedTitles).size !== normalizedTitles.length) {
    throw new RecoveryValidationError(
      "Use a different title for each smaller task.",
      "breakdownTitles"
    );
  }

  return normalizedTitles;
}

function wrapRecoveryError(message: string, error: unknown): Error {
  if (
    error instanceof RecoveryValidationError ||
    error instanceof RecoveryItemNotFoundError ||
    error instanceof RecoveryPersistenceError
  ) {
    return error;
  }

  return new RecoveryPersistenceError(message, error);
}

import {
  CreateTaskInput,
  LocalDateString,
  LocalTimeString,
  Task,
  TaskStatus
} from "../../types/task";
import {
  getLocalDateString,
  normalizeLocalDateInput,
  normalizeOptionalTime
} from "../../utils/dates";
import { createTaskId } from "../../utils/ids";
import { SqlExecutor } from "../sql";
import { TaskNotFoundError, TaskPersistenceError, TaskValidationError } from "./errors";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  scheduledDate: LocalDateString;
  scheduledTime: LocalTimeString | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
};

type Clock = () => Date;
type IdGenerator = () => string;

const taskSelect = `
  SELECT
    id,
    title,
    description,
    status,
    scheduled_date AS scheduledDate,
    scheduled_time AS scheduledTime,
    created_at AS createdAt,
    updated_at AS updatedAt,
    completed_at AS completedAt,
    deleted_at AS deletedAt
  FROM tasks
`;

export class TaskRepository {
  constructor(
    private readonly database: SqlExecutor,
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
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      deletedAt: null
    };

    try {
      await this.database.runAsync(
        `
          INSERT INTO tasks (
            id,
            title,
            description,
            status,
            scheduled_date,
            scheduled_time,
            created_at,
            updated_at,
            completed_at,
            deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        task.id,
        task.title,
        task.description,
        task.status,
        task.scheduledDate,
        task.scheduledTime,
        task.createdAt,
        task.updatedAt,
        task.completedAt,
        task.deletedAt
      );
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
      const rows = await this.database.getAllAsync<TaskRow>(
        `
          ${taskSelect}
          WHERE scheduled_date = ?
            AND deleted_at IS NULL
          ORDER BY
            CASE status WHEN 'completed' THEN 1 ELSE 0 END,
            scheduled_time IS NULL,
            scheduled_time,
            created_at;
        `,
        scheduledDate
      );

      return rows.map(mapTaskRow);
    } catch (error) {
      throw new TaskPersistenceError(
        "Unable to load tasks for the selected date.",
        error
      );
    }
  }

  async getAllTasks(): Promise<Task[]> {
    try {
      const rows = await this.database.getAllAsync<TaskRow>(`
        ${taskSelect}
        WHERE deleted_at IS NULL
        ORDER BY
          scheduled_date,
          CASE status WHEN 'completed' THEN 1 ELSE 0 END,
          scheduled_time IS NULL,
          scheduled_time,
          created_at;
      `);

      return rows.map(mapTaskRow);
    } catch (error) {
      throw new TaskPersistenceError("Unable to load tasks.", error);
    }
  }

  async completeTask(id: string): Promise<Task> {
    const timestamp = this.clock().toISOString();

    try {
      const result = await this.database.runAsync(
        `
          UPDATE tasks
          SET
            status = 'completed',
            completed_at = COALESCE(completed_at, ?),
            updated_at = ?
          WHERE id = ?
            AND deleted_at IS NULL;
        `,
        timestamp,
        timestamp,
        id
      );

      if (result.changes === 0) {
        throw new TaskNotFoundError();
      }

      return await this.getTaskById(id);
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
      const result = await this.database.runAsync(
        `
          UPDATE tasks
          SET
            status = 'not_started',
            completed_at = NULL,
            updated_at = ?
          WHERE id = ?
            AND deleted_at IS NULL;
        `,
        timestamp,
        id
      );

      if (result.changes === 0) {
        throw new TaskNotFoundError();
      }

      return await this.getTaskById(id);
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        throw error;
      }

      throw new TaskPersistenceError("Unable to undo task completion.", error);
    }
  }

  private async getTaskById(id: string): Promise<Task> {
    const row = await this.database.getFirstAsync<TaskRow>(
      `
        ${taskSelect}
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1;
      `,
      id
    );

    if (!row) {
      throw new TaskNotFoundError();
    }

    return mapTaskRow(row);
  }
}

function normalizeCreateTaskInput(
  input: CreateTaskInput
): Pick<Task, "title" | "description" | "scheduledDate" | "scheduledTime"> {
  const title = input.title.trim();

  if (!title) {
    throw new TaskValidationError("Enter a task title.", "title");
  }

  const scheduledDate = normalizeLocalDateInput(input.scheduledDate);

  if (!scheduledDate) {
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

  const description = input.description?.trim() || null;

  return {
    title,
    description,
    scheduledDate: scheduledDate ?? getLocalDateString(),
    scheduledTime
  };
}

function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    scheduledDate: row.scheduledDate,
    scheduledTime: row.scheduledTime,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
    deletedAt: row.deletedAt
  };
}

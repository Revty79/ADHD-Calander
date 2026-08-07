import { LocalDateString, LocalTimeString, Task, TaskStatus } from "../types/task";
import { SqlExecutor } from "./sql";
import { TaskStorage } from "./taskStorage";

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

export class SqlTaskStorage implements TaskStorage {
  constructor(private readonly database: SqlExecutor) {}

  async insertTask(task: Task): Promise<void> {
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
  }

  async getTasksForDate(scheduledDate: string): Promise<Task[]> {
    const rows = await this.database.getAllAsync<TaskRow>(
      `
        ${taskSelect}
        WHERE scheduled_date = ?
          AND deleted_at IS NULL;
      `,
      scheduledDate
    );

    return rows.map(mapTaskRow);
  }

  async getAllTasks(): Promise<Task[]> {
    const rows = await this.database.getAllAsync<TaskRow>(`
      ${taskSelect}
      WHERE deleted_at IS NULL;
    `);

    return rows.map(mapTaskRow);
  }

  async getTaskById(id: string): Promise<Task | null> {
    const row = await this.database.getFirstAsync<TaskRow>(
      `
        ${taskSelect}
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1;
      `,
      id
    );

    return row ? mapTaskRow(row) : null;
  }

  async updateTask(task: Task): Promise<boolean> {
    const result = await this.database.runAsync(
      `
        UPDATE tasks
        SET
          title = ?,
          description = ?,
          status = ?,
          scheduled_date = ?,
          scheduled_time = ?,
          created_at = ?,
          updated_at = ?,
          completed_at = ?,
          deleted_at = ?
        WHERE id = ?
          AND deleted_at IS NULL;
      `,
      task.title,
      task.description,
      task.status,
      task.scheduledDate,
      task.scheduledTime,
      task.createdAt,
      task.updatedAt,
      task.completedAt,
      task.deletedAt,
      task.id
    );

    return result.changes !== 0;
  }
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

import {
  LocalDateString,
  LocalTimeString,
  Task,
  TaskImportance,
  TaskStatus
} from "../types/task";
import { SqlExecutor } from "./sql";
import { TaskStorage } from "./taskStorage";
import { parseStoredReminderOffsets } from "../notifications/reminderOffsets";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  importance: TaskImportance;
  status: TaskStatus;
  parentTaskId: string | null;
  scheduledDate: LocalDateString | null;
  scheduledTime: LocalTimeString | null;
  estimatedDurationMinutes: number | null;
  deadlineDate: LocalDateString | null;
  reminderOffsets: string;
  startedAt: string | null;
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
    importance,
    status,
    parent_task_id AS parentTaskId,
    scheduled_date AS scheduledDate,
    scheduled_time AS scheduledTime,
    estimated_duration_minutes AS estimatedDurationMinutes,
    deadline_date AS deadlineDate,
    reminder_offsets AS reminderOffsets,
    started_at AS startedAt,
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
          importance,
          status,
          parent_task_id,
          scheduled_date,
          scheduled_time,
          estimated_duration_minutes,
          deadline_date,
          reminder_offsets,
          started_at,
          created_at,
          updated_at,
          completed_at,
          deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      task.id,
      task.title,
      task.description,
      task.importance,
      task.status,
      task.parentTaskId,
      task.scheduledDate,
      task.scheduledTime,
      task.estimatedDurationMinutes,
      task.deadlineDate,
      JSON.stringify(task.reminderOffsets),
      task.startedAt,
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

  async getChildTasks(parentTaskId: string): Promise<Task[]> {
    const rows = await this.database.getAllAsync<TaskRow>(
      `
        ${taskSelect}
        WHERE parent_task_id = ?
          AND deleted_at IS NULL
        ORDER BY created_at, id;
      `,
      parentTaskId
    );

    return rows.map(mapTaskRow);
  }

  async updateTask(task: Task): Promise<boolean> {
    const result = await this.database.runAsync(
      `
        UPDATE tasks
        SET
          title = ?,
          description = ?,
          importance = ?,
          status = ?,
          parent_task_id = ?,
          scheduled_date = ?,
          scheduled_time = ?,
          estimated_duration_minutes = ?,
          deadline_date = ?,
          reminder_offsets = ?,
          started_at = ?,
          created_at = ?,
          updated_at = ?,
          completed_at = ?,
          deleted_at = ?
        WHERE id = ?
          AND deleted_at IS NULL;
      `,
      task.title,
      task.description,
      task.importance,
      task.status,
      task.parentTaskId,
      task.scheduledDate,
      task.scheduledTime,
      task.estimatedDurationMinutes,
      task.deadlineDate,
      JSON.stringify(task.reminderOffsets),
      task.startedAt,
      task.createdAt,
      task.updatedAt,
      task.completedAt,
      task.deletedAt,
      task.id
    );

    return result.changes !== 0;
  }

  async saveTaskGroup(updatedTasks: Task[], createdTasks: Task[]): Promise<void> {
    await this.database.execAsync("BEGIN IMMEDIATE;");

    try {
      for (const task of updatedTasks) {
        if (!(await this.updateTask(task))) {
          throw new Error(`Task ${task.id} could not be updated.`);
        }
      }

      for (const task of createdTasks) {
        await this.insertTask(task);
      }

      await this.database.execAsync("COMMIT;");
    } catch (error) {
      try {
        await this.database.execAsync("ROLLBACK;");
      } catch {}

      throw error;
    }
  }
}

function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    importance: row.importance,
    status: row.status,
    parentTaskId: row.parentTaskId,
    scheduledDate: row.scheduledDate,
    scheduledTime: row.scheduledTime,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    deadlineDate: row.deadlineDate,
    reminderOffsets: parseStoredReminderOffsets(row.reminderOffsets),
    startedAt: row.startedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
    deletedAt: row.deletedAt
  };
}

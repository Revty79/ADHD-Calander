import {
  RecoveryDecisionType,
  RecoveryItem,
  RecoveryItemStatus,
  RecoverySession,
  RecoverySessionStatus
} from "../types/recovery";
import { LocalDateString, LocalTimeString } from "../types/dateTime";
import { TaskStatus } from "../types/task";
import { RecoveryDecisionMutation, RecoveryStorage } from "./recoveryStorage";
import { SqlExecutor } from "./sql";
import { SqlTaskStorage } from "./sqlTaskStorage";

type RecoverySessionRow = {
  id: string;
  sourceDate: LocalDateString;
  status: RecoverySessionStatus;
  startedAt: string;
  completedAt: string | null;
};

type RecoveryItemRow = {
  id: string;
  sessionId: string;
  taskId: string;
  originalTitle: string;
  originalStatus: TaskStatus;
  originalScheduledDate: LocalDateString;
  originalScheduledTime: LocalTimeString | null;
  originalEstimatedDurationMinutes: number | null;
  status: RecoveryItemStatus;
  decision: RecoveryDecisionType | null;
  note: string | null;
  rescheduledDate: LocalDateString | null;
  rescheduledTime: LocalTimeString | null;
  createdTaskIds: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const sessionSelect = `
  SELECT
    id,
    source_date AS sourceDate,
    status,
    started_at AS startedAt,
    completed_at AS completedAt
  FROM recovery_sessions
`;

const itemSelect = `
  SELECT
    id,
    session_id AS sessionId,
    task_id AS taskId,
    original_title AS originalTitle,
    original_status AS originalStatus,
    original_scheduled_date AS originalScheduledDate,
    original_scheduled_time AS originalScheduledTime,
    original_estimated_duration_minutes AS originalEstimatedDurationMinutes,
    status,
    decision,
    note,
    rescheduled_date AS rescheduledDate,
    rescheduled_time AS rescheduledTime,
    created_task_ids AS createdTaskIds,
    reviewed_at AS reviewedAt,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM recovery_items
`;

export class SqlRecoveryStorage implements RecoveryStorage {
  private readonly taskStorage: SqlTaskStorage;

  constructor(private readonly database: SqlExecutor) {
    this.taskStorage = new SqlTaskStorage(database);
  }

  async insertSession(session: RecoverySession): Promise<void> {
    await this.runTransaction(async () => {
      await this.database.runAsync(
        `
          INSERT INTO recovery_sessions (
            id, source_date, status, started_at, completed_at
          ) VALUES (?, ?, ?, ?, ?);
        `,
        session.id,
        session.sourceDate,
        session.status,
        session.startedAt,
        session.completedAt
      );

      for (const item of session.items) {
        await this.insertItem(item);
      }
    });
  }

  async getActiveSession(): Promise<RecoverySession | null> {
    const row = await this.database.getFirstAsync<RecoverySessionRow>(`
      ${sessionSelect}
      WHERE status = 'active'
      LIMIT 1;
    `);

    return row ? this.loadSession(row) : null;
  }

  async getLatestCompletedSession(): Promise<RecoverySession | null> {
    const row = await this.database.getFirstAsync<RecoverySessionRow>(`
      ${sessionSelect}
      WHERE status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1;
    `);

    return row ? this.loadSession(row) : null;
  }

  async getSessionsForDate(sourceDate: string): Promise<RecoverySession[]> {
    const rows = await this.database.getAllAsync<RecoverySessionRow>(
      `
        ${sessionSelect}
        WHERE source_date = ?
        ORDER BY started_at, id;
      `,
      sourceDate
    );

    return Promise.all(rows.map((row) => this.loadSession(row)));
  }

  async saveDecision(mutation: RecoveryDecisionMutation): Promise<void> {
    await this.runTransaction(async () => {
      for (const task of mutation.updatedTasks) {
        if (!(await this.taskStorage.updateTask(task))) {
          throw new Error(`Task ${task.id} could not be updated.`);
        }
      }

      for (const task of mutation.createdTasks) {
        await this.taskStorage.insertTask(task);
      }

      const result = await this.database.runAsync(
        `
          UPDATE recovery_items
          SET
            status = ?,
            decision = ?,
            note = ?,
            rescheduled_date = ?,
            rescheduled_time = ?,
            created_task_ids = ?,
            reviewed_at = ?,
            updated_at = ?
          WHERE id = ?;
        `,
        mutation.item.status,
        mutation.item.decision,
        mutation.item.note,
        mutation.item.rescheduledDate,
        mutation.item.rescheduledTime,
        JSON.stringify(mutation.item.createdTaskIds),
        mutation.item.reviewedAt,
        mutation.item.updatedAt,
        mutation.item.id
      );

      if (result.changes === 0) {
        throw new Error(`Recovery item ${mutation.item.id} could not be updated.`);
      }
    });
  }

  async updateSession(session: RecoverySession): Promise<void> {
    const result = await this.database.runAsync(
      `
        UPDATE recovery_sessions
        SET status = ?, completed_at = ?
        WHERE id = ?;
      `,
      session.status,
      session.completedAt,
      session.id
    );

    if (result.changes === 0) {
      throw new Error(`Recovery session ${session.id} could not be updated.`);
    }
  }

  private async insertItem(item: RecoveryItem): Promise<void> {
    await this.database.runAsync(
      `
        INSERT INTO recovery_items (
          id,
          session_id,
          task_id,
          original_title,
          original_status,
          original_scheduled_date,
          original_scheduled_time,
          original_estimated_duration_minutes,
          status,
          decision,
          note,
          rescheduled_date,
          rescheduled_time,
          created_task_ids,
          reviewed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      item.id,
      item.sessionId,
      item.taskId,
      item.originalTitle,
      item.originalStatus,
      item.originalScheduledDate,
      item.originalScheduledTime,
      item.originalEstimatedDurationMinutes,
      item.status,
      item.decision,
      item.note,
      item.rescheduledDate,
      item.rescheduledTime,
      JSON.stringify(item.createdTaskIds),
      item.reviewedAt,
      item.createdAt,
      item.updatedAt
    );
  }

  private async loadSession(row: RecoverySessionRow): Promise<RecoverySession> {
    const itemRows = await this.database.getAllAsync<RecoveryItemRow>(
      `
        ${itemSelect}
        WHERE session_id = ?
        ORDER BY created_at, id;
      `,
      row.id
    );

    return {
      id: row.id,
      sourceDate: row.sourceDate,
      status: row.status,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      items: itemRows.map(mapRecoveryItemRow)
    };
  }

  private async runTransaction(work: () => Promise<void>): Promise<void> {
    await this.database.execAsync("BEGIN IMMEDIATE;");

    try {
      await work();
      await this.database.execAsync("COMMIT;");
    } catch (error) {
      try {
        await this.database.execAsync("ROLLBACK;");
      } catch {}

      throw error;
    }
  }
}

function mapRecoveryItemRow(row: RecoveryItemRow): RecoveryItem {
  return {
    id: row.id,
    sessionId: row.sessionId,
    taskId: row.taskId,
    originalTitle: row.originalTitle,
    originalStatus: row.originalStatus,
    originalScheduledDate: row.originalScheduledDate,
    originalScheduledTime: row.originalScheduledTime,
    originalEstimatedDurationMinutes: row.originalEstimatedDurationMinutes,
    status: row.status,
    decision: row.decision,
    note: row.note,
    rescheduledDate: row.rescheduledDate,
    rescheduledTime: row.rescheduledTime,
    createdTaskIds: parseCreatedTaskIds(row.createdTaskIds),
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function parseCreatedTaskIds(value: string): string[] {
  const parsedValue: unknown = JSON.parse(value);

  if (
    !Array.isArray(parsedValue) ||
    !parsedValue.every((item): item is string => typeof item === "string")
  ) {
    throw new Error("Stored recovery task IDs have an invalid shape.");
  }

  return parsedValue;
}

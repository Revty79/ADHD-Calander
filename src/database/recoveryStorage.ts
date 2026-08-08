import { RecoveryItem, RecoverySession } from "../types/recovery";
import { Task } from "../types/task";

export type RecoveryDecisionMutation = {
  item: RecoveryItem;
  updatedTasks: Task[];
  createdTasks: Task[];
};

export type RecoveryStorage = {
  insertSession(session: RecoverySession): Promise<void>;
  getActiveSession(): Promise<RecoverySession | null>;
  getLatestCompletedSession(): Promise<RecoverySession | null>;
  getSessionsForDate(sourceDate: string): Promise<RecoverySession[]>;
  saveDecision(mutation: RecoveryDecisionMutation): Promise<void>;
  updateSession(session: RecoverySession): Promise<void>;
};

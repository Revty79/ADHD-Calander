import { Task } from "../types/task";

export type TaskStorage = {
  insertTask(task: Task): Promise<void>;
  getTasksForDate(scheduledDate: string): Promise<Task[]>;
  getAllTasks(): Promise<Task[]>;
  getTaskById(id: string): Promise<Task | null>;
  updateTask(task: Task): Promise<boolean>;
};

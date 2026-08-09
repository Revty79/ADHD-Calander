import { Task } from "../types/task";

export type TaskStorage = {
  insertTask(task: Task): Promise<void>;
  getTasksForDate(scheduledDate: string): Promise<Task[]>;
  getAllTasks(): Promise<Task[]>;
  getTaskById(id: string): Promise<Task | null>;
  getChildTasks(parentTaskId: string): Promise<Task[]>;
  updateTask(task: Task): Promise<boolean>;
  saveTaskGroup(updatedTasks: Task[], createdTasks: Task[]): Promise<void>;
};

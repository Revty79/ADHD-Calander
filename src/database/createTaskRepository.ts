import { initializeDatabase } from "./database";
import { TaskRepository } from "./repositories/taskRepository";
import { SqlTaskStorage } from "./sqlTaskStorage";

export async function createTaskRepository(): Promise<TaskRepository> {
  const database = await initializeDatabase();

  return new TaskRepository(new SqlTaskStorage(database));
}

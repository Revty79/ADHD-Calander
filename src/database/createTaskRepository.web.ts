import { openIndexedDbTaskStorage } from "./indexedDbTaskStorage.web";
import { TaskRepository } from "./repositories/taskRepository";

export async function createTaskRepository(): Promise<TaskRepository> {
  const storage = await openIndexedDbTaskStorage();

  return new TaskRepository(storage);
}

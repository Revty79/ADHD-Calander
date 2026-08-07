import { openIndexedDbStorages } from "./indexedDbTaskStorage.web";
import { CalendarEventRepository } from "./repositories/calendarEventRepository";
import { TaskRepository } from "./repositories/taskRepository";

export type AppRepositories = {
  taskRepository: TaskRepository;
  calendarEventRepository: CalendarEventRepository;
};

export async function createRepositories(): Promise<AppRepositories> {
  const { taskStorage, calendarEventStorage } = await openIndexedDbStorages();

  return {
    taskRepository: new TaskRepository(taskStorage),
    calendarEventRepository: new CalendarEventRepository(calendarEventStorage)
  };
}

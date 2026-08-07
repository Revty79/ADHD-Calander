import { openIndexedDbStorages } from "./indexedDbTaskStorage.web";
import { CalendarEventRepository } from "./repositories/calendarEventRepository";
import { RecoveryRepository } from "./repositories/recoveryRepository";
import { TaskRepository } from "./repositories/taskRepository";

export type AppRepositories = {
  taskRepository: TaskRepository;
  calendarEventRepository: CalendarEventRepository;
  recoveryRepository: RecoveryRepository;
};

export async function createRepositories(): Promise<AppRepositories> {
  const { taskStorage, calendarEventStorage, recoveryStorage } =
    await openIndexedDbStorages();

  return {
    taskRepository: new TaskRepository(taskStorage),
    calendarEventRepository: new CalendarEventRepository(calendarEventStorage),
    recoveryRepository: new RecoveryRepository(recoveryStorage, taskStorage)
  };
}

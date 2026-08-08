import { openIndexedDbStorages } from "./indexedDbTaskStorage.web";
import { CalendarEventRepository } from "./repositories/calendarEventRepository";
import { DailyRecapRepository } from "./repositories/dailyRecapRepository";
import { RecoveryRepository } from "./repositories/recoveryRepository";
import { TaskRepository } from "./repositories/taskRepository";

export type AppRepositories = {
  taskRepository: TaskRepository;
  calendarEventRepository: CalendarEventRepository;
  recoveryRepository: RecoveryRepository;
  dailyRecapRepository: DailyRecapRepository;
};

export async function createRepositories(): Promise<AppRepositories> {
  const { taskStorage, calendarEventStorage, recoveryStorage } =
    await openIndexedDbStorages();
  const taskRepository = new TaskRepository(taskStorage);
  const calendarEventRepository = new CalendarEventRepository(calendarEventStorage);
  const recoveryRepository = new RecoveryRepository(recoveryStorage, taskStorage);

  return {
    taskRepository,
    calendarEventRepository,
    recoveryRepository,
    dailyRecapRepository: new DailyRecapRepository(
      taskRepository,
      calendarEventRepository,
      recoveryRepository
    )
  };
}

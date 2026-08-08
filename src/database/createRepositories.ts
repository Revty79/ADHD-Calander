import { initializeDatabase } from "./database";
import { CalendarEventRepository } from "./repositories/calendarEventRepository";
import { DailyRecapRepository } from "./repositories/dailyRecapRepository";
import { RecoveryRepository } from "./repositories/recoveryRepository";
import { TaskRepository } from "./repositories/taskRepository";
import { SqlCalendarEventStorage } from "./sqlCalendarEventStorage";
import { SqlRecoveryStorage } from "./sqlRecoveryStorage";
import { SqlTaskStorage } from "./sqlTaskStorage";

export type AppRepositories = {
  taskRepository: TaskRepository;
  calendarEventRepository: CalendarEventRepository;
  recoveryRepository: RecoveryRepository;
  dailyRecapRepository: DailyRecapRepository;
};

export async function createRepositories(): Promise<AppRepositories> {
  const database = await initializeDatabase();
  const taskStorage = new SqlTaskStorage(database);
  const taskRepository = new TaskRepository(taskStorage);
  const calendarEventRepository = new CalendarEventRepository(
    new SqlCalendarEventStorage(database)
  );
  const recoveryRepository = new RecoveryRepository(
    new SqlRecoveryStorage(database),
    taskStorage
  );

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

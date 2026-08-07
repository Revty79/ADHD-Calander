import { initializeDatabase } from "./database";
import { CalendarEventRepository } from "./repositories/calendarEventRepository";
import { RecoveryRepository } from "./repositories/recoveryRepository";
import { TaskRepository } from "./repositories/taskRepository";
import { SqlCalendarEventStorage } from "./sqlCalendarEventStorage";
import { SqlRecoveryStorage } from "./sqlRecoveryStorage";
import { SqlTaskStorage } from "./sqlTaskStorage";

export type AppRepositories = {
  taskRepository: TaskRepository;
  calendarEventRepository: CalendarEventRepository;
  recoveryRepository: RecoveryRepository;
};

export async function createRepositories(): Promise<AppRepositories> {
  const database = await initializeDatabase();
  const taskStorage = new SqlTaskStorage(database);

  return {
    taskRepository: new TaskRepository(taskStorage),
    calendarEventRepository: new CalendarEventRepository(
      new SqlCalendarEventStorage(database)
    ),
    recoveryRepository: new RecoveryRepository(
      new SqlRecoveryStorage(database),
      taskStorage
    )
  };
}

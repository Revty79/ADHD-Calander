import { initializeDatabase } from "./database";
import { CalendarEventRepository } from "./repositories/calendarEventRepository";
import { TaskRepository } from "./repositories/taskRepository";
import { SqlCalendarEventStorage } from "./sqlCalendarEventStorage";
import { SqlTaskStorage } from "./sqlTaskStorage";

export type AppRepositories = {
  taskRepository: TaskRepository;
  calendarEventRepository: CalendarEventRepository;
};

export async function createRepositories(): Promise<AppRepositories> {
  const database = await initializeDatabase();

  return {
    taskRepository: new TaskRepository(new SqlTaskStorage(database)),
    calendarEventRepository: new CalendarEventRepository(
      new SqlCalendarEventStorage(database)
    )
  };
}

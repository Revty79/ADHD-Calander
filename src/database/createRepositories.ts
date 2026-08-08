import { initializeDatabase } from "./database";
import { ExpoNotificationAdapter } from "../notifications/expoNotificationAdapter";
import { ReminderService } from "../notifications/reminderService";
import { SchedulingService } from "../features/scheduling/schedulingService";
import { CalendarEventRepository } from "./repositories/calendarEventRepository";
import { DailyRecapRepository } from "./repositories/dailyRecapRepository";
import { RecoveryRepository } from "./repositories/recoveryRepository";
import { SettingsRepository } from "./repositories/settingsRepository";
import { TaskRepository } from "./repositories/taskRepository";
import { SqlCalendarEventStorage } from "./sqlCalendarEventStorage";
import { SqlRecoveryStorage } from "./sqlRecoveryStorage";
import { SqlSettingsStorage } from "./sqlSettingsStorage";
import { SqlTaskStorage } from "./sqlTaskStorage";

export type AppRepositories = {
  taskRepository: TaskRepository;
  calendarEventRepository: CalendarEventRepository;
  recoveryRepository: RecoveryRepository;
  dailyRecapRepository: DailyRecapRepository;
  settingsRepository: SettingsRepository;
  reminderService: ReminderService;
  schedulingService: SchedulingService;
};

export async function createRepositories(): Promise<AppRepositories> {
  const database = await initializeDatabase();
  const taskStorage = new SqlTaskStorage(database);
  const calendarEventStorage = new SqlCalendarEventStorage(database);
  const settingsRepository = new SettingsRepository(new SqlSettingsStorage(database));
  const reminderService = new ReminderService(
    settingsRepository,
    taskStorage,
    calendarEventStorage,
    new ExpoNotificationAdapter()
  );
  const taskRepository = new TaskRepository(
    taskStorage,
    undefined,
    undefined,
    reminderService
  );
  const calendarEventRepository = new CalendarEventRepository(
    calendarEventStorage,
    undefined,
    undefined,
    reminderService
  );
  const recoveryRepository = new RecoveryRepository(
    new SqlRecoveryStorage(database),
    taskStorage,
    undefined,
    undefined,
    undefined,
    undefined,
    reminderService
  );
  const schedulingService = new SchedulingService(
    taskRepository,
    calendarEventRepository,
    settingsRepository
  );

  return {
    taskRepository,
    calendarEventRepository,
    recoveryRepository,
    settingsRepository,
    reminderService,
    schedulingService,
    dailyRecapRepository: new DailyRecapRepository(
      taskRepository,
      calendarEventRepository,
      recoveryRepository
    )
  };
}

import { openIndexedDbStorages } from "./indexedDbTaskStorage.web";
import { ReminderService } from "../notifications/reminderService";
import { UnsupportedNotificationAdapter } from "../notifications/unsupportedNotificationAdapter";
import { SchedulingService } from "../features/scheduling/schedulingService";
import { CalendarEventRepository } from "./repositories/calendarEventRepository";
import { DailyRecapRepository } from "./repositories/dailyRecapRepository";
import { RecoveryRepository } from "./repositories/recoveryRepository";
import { SettingsRepository } from "./repositories/settingsRepository";
import { TaskRepository } from "./repositories/taskRepository";

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
  const { taskStorage, calendarEventStorage, recoveryStorage, settingsStorage } =
    await openIndexedDbStorages();
  const settingsRepository = new SettingsRepository(settingsStorage);
  const reminderService = new ReminderService(
    settingsRepository,
    taskStorage,
    calendarEventStorage,
    new UnsupportedNotificationAdapter()
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
    recoveryStorage,
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

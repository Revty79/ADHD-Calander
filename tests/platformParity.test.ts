import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { IDBFactory, IDBKeyRange } from "fake-indexeddb";

import { CalendarEventStorage } from "../src/database/calendarEventStorage";
import { initializeDatabase } from "../src/database/database";
import { openIndexedDbStorages } from "../src/database/indexedDbTaskStorage.web";
import { RecoveryStorage } from "../src/database/recoveryStorage";
import { CalendarEventRepository } from "../src/database/repositories/calendarEventRepository";
import { DailyRecapRepository } from "../src/database/repositories/dailyRecapRepository";
import { TaskValidationError } from "../src/database/repositories/errors";
import { RecoveryRepository } from "../src/database/repositories/recoveryRepository";
import { SettingsRepository } from "../src/database/repositories/settingsRepository";
import { TaskRepository } from "../src/database/repositories/taskRepository";
import { SettingsStorage } from "../src/database/settingsStorage";
import { SqlCalendarEventStorage } from "../src/database/sqlCalendarEventStorage";
import { SqlRecoveryStorage } from "../src/database/sqlRecoveryStorage";
import { SqlSettingsStorage } from "../src/database/sqlSettingsStorage";
import { SqlTaskStorage } from "../src/database/sqlTaskStorage";
import { TaskStorage } from "../src/database/taskStorage";
import {
  getRecapRouteDate,
  selectRecapDate
} from "../src/features/recap/recapDateSelection";
import { SchedulingService } from "../src/features/scheduling/schedulingService";
import {
  formatSuggestedTaskTimeOption,
  formatTransitionBufferOption,
  planningSettingsSummary
} from "../src/features/settings/planningPresentation";
import {
  buildTaskEditorInput,
  getTaskPlanningTransition,
  getTaskReminderDisabledMessage
} from "../src/features/tasks/taskEditorModel";
import { createSqlJsDatabase, SqlJsDatabase } from "./helpers/sqlJsDatabase";

const localDate = "2026-08-10";
const nextLocalDate = "2026-08-11";
const clock = () => new Date(2026, 7, 10, 7, 0, 0);

type StorageBundle = {
  taskStorage: TaskStorage;
  calendarEventStorage: CalendarEventStorage;
  recoveryStorage: RecoveryStorage;
  settingsStorage: SettingsStorage;
};

type RepositorySet = ReturnType<typeof createRepositorySet>;

type PlatformHarness = RepositorySet & {
  reopen(): Promise<RepositorySet>;
};

describe("Web and Android parity contracts", () => {
  it("shares task editor, Recap date, and planning terminology rules", () => {
    assert.deepEqual(getTaskPlanningTransition("scheduled", "", "", "", "2026-08-10"), {
      planningState: "scheduled",
      scheduledDate: "2026-08-10",
      scheduledTime: "",
      preferredTime: ""
    });
    assert.deepEqual(
      getTaskPlanningTransition("planned", "2026-08-10", "09:30", "", ""),
      {
        planningState: "planned",
        scheduledDate: "2026-08-10",
        scheduledTime: "",
        preferredTime: "09:30"
      }
    );
    assert.deepEqual(
      getTaskPlanningTransition("scheduled", "2026-08-10", "", "14:00", ""),
      {
        planningState: "scheduled",
        scheduledDate: "2026-08-10",
        scheduledTime: "14:00",
        preferredTime: ""
      }
    );
    assert.deepEqual(
      buildTaskEditorInput({
        title: "Prepare notes",
        description: "Bring the checklist",
        importance: "important",
        color: "neutral",
        planningState: "flexible",
        scheduledDate: "2026-08-10",
        scheduledTime: "09:30",
        preferredTime: "14:00",
        estimatedDurationMinutes: 30,
        deadlineDate: "2026-08-12",
        deadlineTime: "15:30",
        reminders: [
          { kind: "relative", offsetMinutes: 60 },
          { kind: "relative", offsetMinutes: 0 }
        ]
      }),
      {
        title: "Prepare notes",
        description: "Bring the checklist",
        importance: "important",
        color: "neutral",
        scheduledDate: null,
        scheduledTime: null,
        preferredTime: null,
        estimatedDurationMinutes: 30,
        deadlineDate: "2026-08-12",
        deadlineTime: "15:30",
        reminders: [
          { kind: "relative", offsetMinutes: 60 },
          { kind: "relative", offsetMinutes: 0 }
        ]
      }
    );
    assert.throws(
      () =>
        buildTaskEditorInput({
          title: "Needs an exact start",
          description: "",
          importance: "normal",
          planningState: "scheduled",
          scheduledDate: "2026-08-10",
          scheduledTime: "",
          preferredTime: "",
          estimatedDurationMinutes: 30,
          deadlineDate: "",
          deadlineTime: "",
          reminders: []
        }),
      (error) => error instanceof TaskValidationError && error.field === "scheduledTime"
    );
    assert.throws(
      () =>
        buildTaskEditorInput({
          title: "Needs a planned date",
          description: "",
          importance: "normal",
          planningState: "planned",
          scheduledDate: "",
          scheduledTime: "",
          preferredTime: "14:00",
          estimatedDurationMinutes: 30,
          deadlineDate: "",
          deadlineTime: "",
          reminders: []
        }),
      (error) => error instanceof TaskValidationError && error.field === "scheduledDate"
    );
    assert.equal(
      getTaskReminderDisabledMessage("scheduled", "unsupported", false),
      "Notification delivery is unavailable on this platform."
    );
    assert.deepEqual(selectRecapDate("not-a-date", localDate), {
      ok: false,
      errorMessage: "Use a date in YYYY-MM-DD format."
    });
    assert.deepEqual(selectRecapDate(nextLocalDate, localDate), {
      ok: false,
      errorMessage: "Choose today or an earlier date."
    });
    assert.equal(getRecapRouteDate(["2026-08-09"], localDate), "2026-08-09");
    assert.equal(getRecapRouteDate(nextLocalDate, localDate), localDate);
    assert.equal(formatTransitionBufferOption(15), "15 min");
    assert.equal(formatSuggestedTaskTimeOption(180), "3 hr");
    assert.equal(
      planningSettingsSummary,
      "Suggestions search seven days by default and never fill time without your confirmation."
    );
  });

  it("persists equivalent task, event, settings, and scheduling outcomes", async () => {
    const [androidHarness, webHarness] = await Promise.all([
      createSqlHarness(),
      createWebHarness("platform-parity-planning")
    ]);

    const [androidSnapshot, webSnapshot] = await Promise.all([
      runPlanningWorkflow(androidHarness),
      runPlanningWorkflow(webHarness)
    ]);

    assert.deepEqual(webSnapshot, androidSnapshot);
  });

  it("persists equivalent Recovery and Recap outcomes", async () => {
    const [androidHarness, webHarness] = await Promise.all([
      createSqlHarness(),
      createWebHarness("platform-parity-recovery")
    ]);

    const [androidSnapshot, webSnapshot] = await Promise.all([
      runRecoveryWorkflow(androidHarness),
      runRecoveryWorkflow(webHarness)
    ]);

    assert.deepEqual(webSnapshot, androidSnapshot);
  });
});

function createRepositorySet(storages: StorageBundle) {
  let taskId = 0;
  let eventId = 0;
  let sessionId = 0;
  let itemId = 0;
  let recoveryTaskId = 0;
  const taskRepository = new TaskRepository(
    storages.taskStorage,
    () => `task-${++taskId}`,
    clock
  );
  const calendarEventRepository = new CalendarEventRepository(
    storages.calendarEventStorage,
    () => (eventId++ === 0 ? "event-b" : "event-a"),
    clock
  );
  const settingsRepository = new SettingsRepository(storages.settingsStorage, clock);
  const recoveryRepository = new RecoveryRepository(
    storages.recoveryStorage,
    storages.taskStorage,
    () => `session-${++sessionId}`,
    () => `item-${++itemId}`,
    () => `recovery-task-${++recoveryTaskId}`,
    clock
  );
  const schedulingService = new SchedulingService(
    taskRepository,
    calendarEventRepository,
    settingsRepository,
    clock
  );

  return {
    taskRepository,
    calendarEventRepository,
    recoveryRepository,
    settingsRepository,
    schedulingService,
    dailyRecapRepository: new DailyRecapRepository(
      taskRepository,
      calendarEventRepository,
      recoveryRepository
    )
  };
}

async function createSqlHarness(): Promise<PlatformHarness> {
  const database = await createSqlJsDatabase();
  await initializeDatabase(database);

  return {
    ...createRepositorySet(createSqlStorageBundle(database)),
    async reopen() {
      const reopenedDatabase = await createSqlJsDatabase(database.exportData());
      await initializeDatabase(reopenedDatabase);

      return createRepositorySet(createSqlStorageBundle(reopenedDatabase));
    }
  };
}

async function createWebHarness(databaseName: string): Promise<PlatformHarness> {
  const indexedDB = new IDBFactory();
  const openStorages = () =>
    openIndexedDbStorages({ databaseName, indexedDB, keyRange: IDBKeyRange });
  const storages = await openStorages();

  return {
    ...createRepositorySet(storages),
    async reopen() {
      return createRepositorySet(await openStorages());
    }
  };
}

function createSqlStorageBundle(database: SqlJsDatabase): StorageBundle {
  return {
    taskStorage: new SqlTaskStorage(database),
    calendarEventStorage: new SqlCalendarEventStorage(database),
    recoveryStorage: new SqlRecoveryStorage(database),
    settingsStorage: new SqlSettingsStorage(database)
  };
}

async function runPlanningWorkflow(harness: PlatformHarness) {
  const flexibleTask = await harness.taskRepository.createTask({
    title: "  Schedule focused work  ",
    description: "  Keep the same task identity  ",
    importance: "important",
    color: "blue",
    estimatedDurationMinutes: 45,
    deadlineDate: nextLocalDate,
    deadlineTime: "17:00",
    reminders: [
      { kind: "absolute", date: localDate, time: "08:00" },
      { kind: "absolute", date: localDate, time: "08:30" }
    ]
  });
  const plannedTask = await harness.taskRepository.createTask({
    title: "Planned review",
    scheduledDate: localDate,
    preferredTime: "14:30",
    estimatedDurationMinutes: 30,
    reminders: [
      { kind: "absolute", date: localDate, time: "09:00" },
      { kind: "absolute", date: localDate, time: "09:30" }
    ]
  });
  const updatedPlannedTask = await harness.taskRepository.updateTask(plannedTask.id, {
    title: "Planned review",
    importance: "normal",
    scheduledDate: localDate,
    scheduledTime: "15:00",
    preferredTime: null,
    estimatedDurationMinutes: 30,
    deadlineDate: nextLocalDate,
    deadlineTime: "15:30",
    reminders: plannedTask.reminders
  });
  assert.equal(updatedPlannedTask.id, plannedTask.id);

  const executionTask = await harness.taskRepository.createTask({
    title: "Execution task",
    scheduledDate: localDate,
    scheduledTime: "13:00",
    estimatedDurationMinutes: 30
  });
  await harness.taskRepository.startTask(executionTask.id);
  await harness.taskRepository.pauseTask(executionTask.id);
  await harness.taskRepository.startTask(executionTask.id);
  await harness.taskRepository.completeTask(executionTask.id);
  await harness.taskRepository.undoTaskCompletion(executionTask.id);

  const breakdownSource = await harness.taskRepository.createTask({
    title: "Prepare materials"
  });
  await harness.taskRepository.breakDownTask(breakdownSource.id, {
    titles: ["Gather notes", "Pack materials"]
  });

  const removableTask = await harness.taskRepository.createTask({
    title: "Optional errand"
  });
  await harness.taskRepository.removeTask(removableTask.id);
  await harness.taskRepository.restoreTask(removableTask.id);

  const recurringEvent = await harness.calendarEventRepository.createEvent({
    title: "Fixed appointment",
    date: localDate,
    startTime: "10:30",
    durationMinutes: 60,
    notes: "Stay fixed",
    color: "rose",
    recurrence: {
      frequency: "daily",
      interval: 1,
      end: { kind: "after_count", count: 2 }
    },
    reminders: [
      { kind: "relative", offsetMinutes: 60 },
      { kind: "absolute", date: localDate, time: "08:45" }
    ]
  });
  await harness.calendarEventRepository.updateEvent(
    recurringEvent.id,
    recurringEvent.date,
    "all",
    { ...recurringEvent, color: "lavender" }
  );
  await harness.calendarEventRepository.createEvent({
    title: "Same-time fixed appointment",
    date: localDate,
    startTime: "10:30",
    durationMinutes: 30,
    color: "amber"
  });
  await harness.settingsRepository.setPlanningPreference("planningDayStart", "07:00");
  await harness.settingsRepository.setPlanningPreference("planningDayEnd", "18:00");
  await harness.settingsRepository.setPlanningPreference("transitionBufferMinutes", 30);
  await harness.settingsRepository.setPlanningPreference(
    "maxSuggestedTaskMinutesPerDay",
    240
  );

  const search = await harness.schedulingService.getSuggestions(flexibleTask.id);
  assert.equal(search.status, "ready");
  const acceptedTask = await harness.schedulingService.acceptSuggestion(
    flexibleTask.id,
    search.suggestions[0]!
  );
  assert.equal(acceptedTask.id, flexibleTask.id);

  const reopened = await harness.reopen();

  return {
    acceptedTask,
    search,
    tasks: await reopened.taskRepository.getAllTasks(),
    events: await reopened.calendarEventRepository.getEventsForDate(localDate),
    settings: await reopened.settingsRepository.getSettings()
  };
}

async function runRecoveryWorkflow(harness: PlatformHarness) {
  const completedTask = await harness.taskRepository.createTask({
    title: "Completed work",
    scheduledDate: localDate,
    estimatedDurationMinutes: 20
  });
  await harness.taskRepository.completeTask(completedTask.id);

  const recoveryTitles = [
    "Keep this",
    "Move this",
    "Break this down",
    "Delegate this",
    "Remove this",
    "Decide on this later"
  ];

  for (const title of recoveryTitles) {
    await harness.taskRepository.createTask({
      title,
      scheduledDate: localDate,
      scheduledTime: title === "Move this" ? "16:00" : null,
      estimatedDurationMinutes: 30,
      reminderOffsets: [15]
    });
  }

  await harness.calendarEventRepository.createEvent({
    title: "Calendar fact",
    date: localDate,
    startTime: "12:00",
    endTime: "13:00"
  });

  const session = await harness.recoveryRepository.startSession(localDate);
  const itemIds = new Map(
    session.items.map((item) => [item.originalTitle, item.id] as const)
  );
  const itemId = (title: string) => {
    const id = itemIds.get(title);

    assert.ok(id);
    return id;
  };

  await harness.recoveryRepository.keepTask(itemId("Keep this"));
  await harness.recoveryRepository.reopenItem(itemId("Keep this"));
  await harness.recoveryRepository.keepTask(itemId("Keep this"));
  await harness.recoveryRepository.rescheduleTask(itemId("Move this"), {
    scheduledDate: nextLocalDate,
    scheduledTime: "09:30"
  });
  await harness.recoveryRepository.breakDownTask(itemId("Break this down"), {
    titles: ["First smaller task", "Second smaller task"]
  });
  await harness.recoveryRepository.delegateTask(itemId("Delegate this"), {
    note: "Ask for help"
  });
  await harness.recoveryRepository.removeTask(itemId("Remove this"));
  await harness.recoveryRepository.skipTask(itemId("Decide on this later"));
  await harness.recoveryRepository.keepTask(itemId("Decide on this later"));
  await harness.recoveryRepository.completeSession();

  const reopened = await harness.reopen();

  return {
    tasks: await reopened.taskRepository.getAllTasks(),
    sessions: await reopened.recoveryRepository.getSessionsForDate(localDate),
    recap: await reopened.dailyRecapRepository.getDailyRecap(localDate)
  };
}

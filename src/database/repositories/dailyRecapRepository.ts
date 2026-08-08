import { CalendarEvent } from "../../types/calendarEvent";
import { LocalDateString } from "../../types/dateTime";
import {
  DailyRecap,
  recapRecoveryDecisionTypes,
  RecapOpenReason,
  RecapOpenTask,
  RecapRecoveryDecisionType,
  RecoveryRecapSummary
} from "../../types/recap";
import { RecoveryItem, RecoverySession } from "../../types/recovery";
import { isTaskActive, Task } from "../../types/task";
import { getLocalDateString, normalizeLocalDateInput } from "../../utils/dates";
import { CalendarEventRepository } from "./calendarEventRepository";
import {
  DailyRecapPersistenceError,
  DailyRecapValidationError
} from "./dailyRecapErrors";
import { RecoveryRepository } from "./recoveryRepository";
import { TaskRepository } from "./taskRepository";

export class DailyRecapRepository {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly calendarEventRepository: CalendarEventRepository,
    private readonly recoveryRepository: RecoveryRepository
  ) {}

  async getDailyRecap(dateInput: string): Promise<DailyRecap> {
    const date = normalizeLocalDateInput(dateInput);

    if (!date) {
      throw new DailyRecapValidationError("Use a recap date in YYYY-MM-DD format.");
    }

    try {
      const [tasks, fixedEvents, recoverySessions] = await Promise.all([
        this.taskRepository.getAllTasks(),
        this.calendarEventRepository.getEventsForDate(date),
        this.recoveryRepository.getSessionsForDate(date)
      ]);

      return buildDailyRecap(date, tasks, fixedEvents, recoverySessions);
    } catch (error) {
      if (error instanceof DailyRecapValidationError) {
        throw error;
      }

      throw new DailyRecapPersistenceError(
        "Unable to load the recap for the selected date.",
        error
      );
    }
  }
}

export function buildDailyRecap(
  date: LocalDateString,
  tasks: Task[],
  fixedEvents: CalendarEvent[],
  recoverySessions: RecoverySession[]
): DailyRecap {
  const accomplishedTasks = tasks
    .filter(
      (task) =>
        task.status === "completed" &&
        task.completedAt !== null &&
        getCompletionLocalDate(task.completedAt) === date
    )
    .sort(compareCompletedTasks);
  const recovery = summarizeRecovery(recoverySessions);

  return {
    date,
    accomplishedTasks,
    completedEstimatedMinutes: accomplishedTasks.reduce(
      (total, task) => total + (task.estimatedDurationMinutes ?? 0),
      0
    ),
    fixedEvents,
    recovery,
    stillOpenTasks: findStillOpenTasks(date, tasks, recoverySessions),
    encouragement: getRecapEncouragement(
      accomplishedTasks.length,
      recovery.totalDecisionCount
    )
  };
}

function summarizeRecovery(sessions: RecoverySession[]): RecoveryRecapSummary {
  const decisionCounts = Object.fromEntries(
    recapRecoveryDecisionTypes.map((decision) => [decision, 0])
  ) as Record<RecapRecoveryDecisionType, number>;
  let waitingDecisionCount = 0;

  for (const session of sessions) {
    for (const item of session.items) {
      if (item.status === "pending") {
        waitingDecisionCount += 1;
        continue;
      }

      if (isRecapRecoveryDecision(item.decision)) {
        decisionCounts[item.decision] += 1;
      }
    }
  }

  return {
    sessionCount: sessions.length,
    decisionCounts,
    totalDecisionCount: Object.values(decisionCounts).reduce(
      (total, count) => total + count,
      0
    ),
    waitingDecisionCount
  };
}

function findStillOpenTasks(
  date: LocalDateString,
  tasks: Task[],
  sessions: RecoverySession[]
): RecapOpenTask[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const recoveryReasons = new Map<string, RecapOpenReason>();

  for (const session of sessions) {
    for (const item of session.items) {
      if (item.status === "pending") {
        recoveryReasons.set(item.taskId, "waiting_decision");
      } else if (item.decision === "keep") {
        recoveryReasons.set(item.taskId, "kept_active");
      }
    }
  }

  const stillOpen = new Map<string, RecapOpenTask>();

  for (const task of tasks) {
    if (task.scheduledDate === date && isTaskActive(task)) {
      stillOpen.set(task.id, { task, reason: "scheduled" });
    }
  }

  for (const [taskId, reason] of recoveryReasons) {
    const task = tasksById.get(taskId);

    if (task && isTaskActive(task)) {
      stillOpen.set(task.id, { task, reason });
    }
  }

  return [...stillOpen.values()].sort(compareOpenTasks);
}

function getCompletionLocalDate(timestamp: string): LocalDateString | null {
  const completionDate = new Date(timestamp);

  return Number.isNaN(completionDate.getTime())
    ? null
    : getLocalDateString(completionDate);
}

function getRecapEncouragement(
  accomplishedCount: number,
  recoveryDecisionCount: number
): string {
  if (accomplishedCount > 0 && recoveryDecisionCount > 0) {
    return "You finished work and adjusted the rest of the plan.";
  }

  if (accomplishedCount > 0) {
    return "You got some things across the line today.";
  }

  if (recoveryDecisionCount > 0) {
    return "Adjusting the plan counts too.";
  }

  return "Today can end without becoming tomorrow's punishment.";
}

function isRecapRecoveryDecision(
  decision: RecoveryItem["decision"]
): decision is RecapRecoveryDecisionType {
  return recapRecoveryDecisionTypes.some((candidate) => candidate === decision);
}

function compareCompletedTasks(first: Task, second: Task): number {
  return (
    (first.completedAt ?? "").localeCompare(second.completedAt ?? "") ||
    first.createdAt.localeCompare(second.createdAt) ||
    first.id.localeCompare(second.id)
  );
}

function compareOpenTasks(first: RecapOpenTask, second: RecapOpenTask): number {
  const reasonOrder: Record<RecapOpenReason, number> = {
    waiting_decision: 0,
    kept_active: 1,
    scheduled: 2
  };

  return (
    reasonOrder[first.reason] - reasonOrder[second.reason] ||
    (first.task.scheduledTime ?? "99:99").localeCompare(
      second.task.scheduledTime ?? "99:99"
    ) ||
    first.task.createdAt.localeCompare(second.task.createdAt) ||
    first.task.id.localeCompare(second.task.id)
  );
}

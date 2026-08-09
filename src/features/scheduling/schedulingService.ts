import { CalendarEventRepository } from "../../database/repositories/calendarEventRepository";
import { SettingsRepository } from "../../database/repositories/settingsRepository";
import { TaskRepository } from "../../database/repositories/taskRepository";
import { ScheduleTaskInput, Task } from "../../types/task";
import { getLocalDateString } from "../../utils/dates";
import { addLocalDays } from "../calendar/calendarDates";
import { generateSchedulingSuggestions } from "./scheduler";
import { SchedulingSearchResult, SchedulingSuggestion } from "./types";

type Clock = () => Date;

export type SchedulingSearchOptions = {
  durationMinutes?: number;
  horizonDays?: number;
};

export type SchedulingAcceptanceOptions = SchedulingSearchOptions & {
  reminderOffsets?: number[];
};

export type SpecificTimeScheduleInput = Pick<
  ScheduleTaskInput,
  "scheduledDate" | "scheduledTime" | "estimatedDurationMinutes" | "reminderOffsets"
>;

export class SchedulingSuggestionUnavailableError extends Error {
  constructor() {
    super("That opening changed. Review the refreshed suggestions and choose again.");
    this.name = "SchedulingSuggestionUnavailableError";
  }
}

export class SchedulingService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly calendarEventRepository: CalendarEventRepository,
    private readonly settingsRepository: SettingsRepository,
    private readonly clock: Clock = () => new Date()
  ) {}

  async getSuggestions(
    taskId: string,
    options: SchedulingSearchOptions = {}
  ): Promise<SchedulingSearchResult> {
    const now = this.clock();
    const today = getLocalDateString(now);
    const horizonDays = normalizeHorizon(options.horizonDays);
    const task = await this.taskRepository.getTaskById(taskId);
    const startDate =
      task.scheduledDate !== null && task.scheduledDate > today
        ? task.scheduledDate
        : today;
    const searchedThrough = addLocalDays(startDate, horizonDays - 1);
    const [tasks, events, settings] = await Promise.all([
      this.taskRepository.getAllTasks(),
      this.calendarEventRepository.getEventsForRange(startDate, searchedThrough),
      this.settingsRepository.getSettings()
    ]);
    const durationMinutes = options.durationMinutes ?? task.estimatedDurationMinutes;

    if (durationMinutes === null) {
      return {
        task,
        status: "needs_duration",
        suggestions: [],
        durationMinutes: null,
        horizonDays,
        searchedThrough,
        preferences: settings
      };
    }

    validateDuration(durationMinutes);

    const suggestions = generateSchedulingSuggestions({
      task: { ...task, estimatedDurationMinutes: durationMinutes },
      tasks,
      events,
      preferences: settings,
      startDate,
      horizonDays,
      now
    });

    return {
      task,
      status: suggestions.length > 0 ? "ready" : "no_windows",
      suggestions,
      durationMinutes,
      horizonDays,
      searchedThrough,
      preferences: settings
    };
  }

  async acceptSuggestion(
    taskId: string,
    suggestion: SchedulingSuggestion,
    options: SchedulingAcceptanceOptions = {}
  ): Promise<Task> {
    const { reminderOffsets, ...searchOptions } = options;
    const refreshed = await this.getSuggestions(taskId, searchOptions);
    const available = refreshed.suggestions.find(
      (candidate) =>
        candidate.date === suggestion.date &&
        candidate.startTime === suggestion.startTime &&
        candidate.endTime === suggestion.endTime &&
        candidate.durationMinutes === suggestion.durationMinutes
    );

    if (!available || refreshed.durationMinutes === null) {
      throw new SchedulingSuggestionUnavailableError();
    }

    return this.taskRepository.scheduleTask(taskId, {
      scheduledDate: available.date,
      scheduledTime: available.startTime,
      estimatedDurationMinutes: refreshed.durationMinutes,
      ...(reminderOffsets === undefined ? {} : { reminderOffsets })
    });
  }

  async scheduleSpecificTime(
    taskId: string,
    input: SpecificTimeScheduleInput
  ): Promise<Task> {
    return this.taskRepository.scheduleTask(taskId, input);
  }
}

function normalizeHorizon(value: number | undefined): number {
  const horizonDays = value ?? 7;

  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 14) {
    throw new Error("Scheduling horizon must be between 1 and 14 days.");
  }

  return horizonDays;
}

function validateDuration(durationMinutes: number): void {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new Error("Task duration must be a positive whole number of minutes.");
  }
}

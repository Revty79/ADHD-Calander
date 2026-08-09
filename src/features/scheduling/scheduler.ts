import { CalendarEvent } from "../../types/calendarEvent";
import { LocalDateString, LocalTimeString } from "../../types/dateTime";
import { isTaskActive, PlannedTimePreference, Task } from "../../types/task";
import { getLocalDateString } from "../../utils/dates";
import { addLocalDays } from "../calendar/calendarDates";
import { getEventDurationMinutes } from "../calendar/calendarSchedule";
import { plannedTimePreferenceRanges } from "../tasks/plannedTimePreferences";
import { DailyLoad, SchedulingEngineInput, SchedulingSuggestion } from "./types";

type MinuteInterval = {
  start: number;
  end: number;
};

type RankedSuggestion = SchedulingSuggestion & {
  loadBand: number;
  preferencePenalty: number;
};

const candidateIncrementMinutes = 15;

export function generateSchedulingSuggestions(
  input: SchedulingEngineInput
): SchedulingSuggestion[] {
  const durationMinutes = input.task.estimatedDurationMinutes;

  if (durationMinutes === null || durationMinutes <= 0 || input.horizonDays <= 0) {
    return [];
  }

  const planningStart = timeToMinutes(input.preferences.planningDayStart);
  const planningEnd = timeToMinutes(input.preferences.planningDayEnd);
  const today = getLocalDateString(input.now);
  const candidates: RankedSuggestion[] = [];

  for (let dayIndex = 0; dayIndex < input.horizonDays; dayIndex += 1) {
    const date = addLocalDays(input.startDate, dayIndex);

    if (input.task.deadlineDate !== null && date > input.task.deadlineDate) {
      continue;
    }

    const events = input.events.filter((event) => event.date === date);
    const tasks = input.tasks.filter(
      (task) =>
        task.id !== input.task.id &&
        isTaskActive(task) &&
        task.scheduledDate === date &&
        task.scheduledTime !== null
    );
    const dailyLoad = calculateDailyLoad(date, events, tasks);

    if (
      dailyLoad.taskMinutes + durationMinutes >
      input.preferences.maxSuggestedTaskMinutesPerDay
    ) {
      continue;
    }

    let effectiveStart = planningStart;

    if (date === today) {
      const nowMinutes = input.now.getHours() * 60 + input.now.getMinutes();
      effectiveStart = Math.max(
        planningStart,
        roundUpToIncrement(nowMinutes + 1, candidateIncrementMinutes)
      );
    }

    if (effectiveStart + durationMinutes > planningEnd) {
      continue;
    }

    const busyIntervals = mergeIntervals([
      ...events.map((event) =>
        getFixedEventInterval(
          event,
          planningStart,
          planningEnd,
          input.preferences.transitionBufferMinutes
        )
      ),
      ...tasks.map((task) => getTimedTaskInterval(task, planningStart, planningEnd))
    ]);
    const freeGaps = getFreeGaps(effectiveStart, planningEnd, busyIntervals);

    for (const gap of freeGaps) {
      const starts = getCandidateStarts(
        gap,
        durationMinutes,
        input.task.plannedTimePreference ?? "anytime"
      );

      for (const start of starts) {
        const end = start + durationMinutes;
        const matchesPreference = isWithinPreference(
          start,
          end,
          input.task.plannedTimePreference ?? "anytime"
        );

        candidates.push({
          date,
          startTime: minutesToTime(start),
          endTime: minutesToTime(end),
          durationMinutes,
          explanation: buildExplanation(
            durationMinutes,
            input.preferences.transitionBufferMinutes,
            dailyLoad,
            input.task.deadlineDate,
            input.task.plannedTimePreference ?? "anytime",
            matchesPreference
          ),
          dailyLoad,
          loadBand: Math.floor(dailyLoad.totalScheduledMinutes / 120),
          preferencePenalty: matchesPreference ? 0 : 1
        });
      }
    }
  }

  candidates.sort(compareSuggestions);

  return selectDiverseSuggestions(candidates, input.maximumSuggestions ?? 3).map(
    ({ loadBand: _loadBand, preferencePenalty: _preferencePenalty, ...suggestion }) =>
      suggestion
  );
}

export function calculateDailyLoad(
  date: LocalDateString,
  events: CalendarEvent[],
  tasks: Task[]
): DailyLoad {
  const fixedEvents = events.filter((event) => event.date === date);
  const scheduledTasks = tasks.filter(
    (task) =>
      isTaskActive(task) && task.scheduledDate === date && task.scheduledTime !== null
  );
  const fixedMinutes = fixedEvents.reduce(
    (total, event) => total + getEventDurationMinutes(event),
    0
  );
  const taskMinutes = scheduledTasks.reduce(
    (total, task) => total + (task.estimatedDurationMinutes ?? 0),
    0
  );

  return {
    date,
    fixedCommitmentCount: fixedEvents.length,
    fixedMinutes,
    scheduledTaskCount: scheduledTasks.length,
    taskMinutes,
    totalScheduledMinutes: fixedMinutes + taskMinutes
  };
}

function getFixedEventInterval(
  event: CalendarEvent,
  planningStart: number,
  planningEnd: number,
  transitionBufferMinutes: number
): MinuteInterval {
  const start = timeToMinutes(event.startTime);
  const knownDuration = getEventDurationMinutes(event);
  const end = knownDuration > 0 ? start + knownDuration : planningEnd;

  return clampInterval(
    {
      start: start - transitionBufferMinutes,
      end: end + transitionBufferMinutes
    },
    planningStart,
    planningEnd
  );
}

function getTimedTaskInterval(
  task: Task,
  planningStart: number,
  planningEnd: number
): MinuteInterval {
  const start = timeToMinutes(task.scheduledTime!);
  const end =
    task.estimatedDurationMinutes === null
      ? planningEnd
      : start + task.estimatedDurationMinutes;

  return clampInterval({ start, end }, planningStart, planningEnd);
}

function clampInterval(
  interval: MinuteInterval,
  planningStart: number,
  planningEnd: number
): MinuteInterval {
  return {
    start: Math.max(planningStart, interval.start),
    end: Math.min(planningEnd, Math.max(interval.start, interval.end))
  };
}

function mergeIntervals(intervals: MinuteInterval[]): MinuteInterval[] {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .sort((first, second) => first.start - second.start || first.end - second.end);
  const merged: MinuteInterval[] = [];

  for (const interval of sorted) {
    const previous = merged.at(-1);

    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval });
      continue;
    }

    previous.end = Math.max(previous.end, interval.end);
  }

  return merged;
}

function getFreeGaps(
  planningStart: number,
  planningEnd: number,
  busyIntervals: MinuteInterval[]
): MinuteInterval[] {
  const gaps: MinuteInterval[] = [];
  let cursor = planningStart;

  for (const interval of busyIntervals) {
    if (interval.start > cursor) {
      gaps.push({ start: cursor, end: interval.start });
    }

    cursor = Math.max(cursor, interval.end);
  }

  if (cursor < planningEnd) {
    gaps.push({ start: cursor, end: planningEnd });
  }

  return gaps;
}

function compareSuggestions(first: RankedSuggestion, second: RankedSuggestion): number {
  return (
    first.loadBand - second.loadBand ||
    first.preferencePenalty - second.preferencePenalty ||
    first.date.localeCompare(second.date) ||
    first.dailyLoad.totalScheduledMinutes - second.dailyLoad.totalScheduledMinutes ||
    first.startTime.localeCompare(second.startTime)
  );
}

function selectDiverseSuggestions(
  candidates: RankedSuggestion[],
  maximumSuggestions: number
): RankedSuggestion[] {
  const selected: RankedSuggestion[] = [];
  const selectedDates = new Set<LocalDateString>();

  for (const candidate of candidates) {
    if (!selectedDates.has(candidate.date)) {
      selected.push(candidate);
      selectedDates.add(candidate.date);
    }

    if (selected.length === maximumSuggestions) {
      return selected;
    }
  }

  for (const candidate of candidates) {
    if (!selected.includes(candidate)) {
      selected.push(candidate);
    }

    if (selected.length === maximumSuggestions) {
      break;
    }
  }

  return selected;
}

function buildExplanation(
  durationMinutes: number,
  transitionBufferMinutes: number,
  dailyLoad: DailyLoad,
  deadlineDate: LocalDateString | null,
  plannedTimePreference: PlannedTimePreference,
  matchesPreference: boolean
): string {
  const parts = [
    `The full ${durationMinutes}-minute estimate fits within your planning hours.`
  ];

  if (transitionBufferMinutes > 0) {
    parts.push(
      `It keeps a ${transitionBufferMinutes}-minute transition buffer around fixed commitments.`
    );
  } else {
    parts.push("It does not overlap fixed commitments or timed tasks.");
  }

  if (deadlineDate !== null) {
    parts.push(`This time is on or before the ${deadlineDate} deadline.`);
  }

  if (plannedTimePreference !== "anytime") {
    parts.push(
      matchesPreference
        ? `It fits your ${plannedTimePreference} preference.`
        : `It is outside your ${plannedTimePreference} preference, but remains available as a fallback.`
    );
  }

  parts.push(
    dailyLoad.totalScheduledMinutes > 0
      ? `${formatMinutes(dailyLoad.totalScheduledMinutes)} is already scheduled that day.`
      : "No timed items with a known duration are already scheduled that day."
  );

  return parts.join(" ");
}

function getCandidateStarts(
  gap: MinuteInterval,
  durationMinutes: number,
  preference: PlannedTimePreference
): number[] {
  const starts = new Set<number>();
  const earliestStart = roundUpToIncrement(gap.start, candidateIncrementMinutes);

  if (earliestStart + durationMinutes <= gap.end) {
    starts.add(earliestStart);
  }

  if (preference !== "anytime") {
    const range = plannedTimePreferenceRanges[preference];
    const preferredStart = roundUpToIncrement(
      Math.max(gap.start, timeToMinutes(range.start)),
      candidateIncrementMinutes
    );
    const preferredEnd = Math.min(gap.end, timeToMinutes(range.end));

    if (preferredStart + durationMinutes <= preferredEnd) {
      starts.add(preferredStart);
    }
  }

  return [...starts];
}

function isWithinPreference(
  start: number,
  end: number,
  preference: PlannedTimePreference
): boolean {
  if (preference === "anytime") {
    return true;
  }

  const range = plannedTimePreferenceRanges[preference];

  return start >= timeToMinutes(range.start) && end <= timeToMinutes(range.end);
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (hours === 0) {
    return `${remaining} minutes`;
  }

  if (remaining === 0) {
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  return `${hours} hours ${remaining} minutes`;
}

function roundUpToIncrement(value: number, increment: number): number {
  return Math.ceil(value / increment) * increment;
}

function timeToMinutes(time: LocalTimeString): number {
  const [hours, minutes] = time.split(":").map(Number);

  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function minutesToTime(minutes: number): LocalTimeString {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(remaining).padStart(2, "0")}` as LocalTimeString;
}

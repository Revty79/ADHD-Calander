import { CalendarEvent } from "../../types/calendarEvent";
import { LocalDateString, LocalTimeString } from "../../types/dateTime";
import { isTaskActive, Task } from "../../types/task";
import { getLocalDateString } from "../../utils/dates";
import { addLocalDays } from "../calendar/calendarDates";
import { getEventDurationMinutes } from "../calendar/calendarSchedule";
import { getDeadlineEndMinutesForDate, localTimeToMinutes } from "../tasks/taskDeadline";
import { DailyLoad, SchedulingEngineInput, SchedulingSuggestion } from "./types";

type MinuteInterval = {
  start: number;
  end: number;
};

type RankedSuggestion = SchedulingSuggestion & {
  loadBand: number;
};

const candidateIncrementMinutes = 15;

export function generateSchedulingSuggestions(
  input: SchedulingEngineInput
): SchedulingSuggestion[] {
  const durationMinutes = input.task.estimatedDurationMinutes;

  if (durationMinutes === null || durationMinutes <= 0 || input.horizonDays <= 0) {
    return [];
  }

  const planningStart = localTimeToMinutes(input.preferences.planningDayStart);
  const planningEnd = localTimeToMinutes(input.preferences.planningDayEnd);
  const today = getLocalDateString(input.now);
  const candidates: RankedSuggestion[] = [];

  for (let dayIndex = 0; dayIndex < input.horizonDays; dayIndex += 1) {
    const date = addLocalDays(input.startDate, dayIndex);

    if (input.task.deadlineDate !== null && date > input.task.deadlineDate) {
      continue;
    }

    const deadlineEnd = getDeadlineEndMinutesForDate(input.task, date);
    const effectiveEnd = Math.min(planningEnd, deadlineEnd ?? planningEnd);

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

    if (effectiveStart + durationMinutes > effectiveEnd) {
      continue;
    }

    const busyIntervals = mergeIntervals([
      ...events.map((event) =>
        getFixedEventInterval(
          event,
          planningStart,
          effectiveEnd,
          input.preferences.transitionBufferMinutes
        )
      ),
      ...tasks.map((task) => getTimedTaskInterval(task, planningStart, effectiveEnd))
    ]);
    const freeGaps = getFreeGaps(effectiveStart, effectiveEnd, busyIntervals);

    for (const gap of freeGaps) {
      const start = roundUpToIncrement(gap.start, candidateIncrementMinutes);
      const end = start + durationMinutes;

      if (end > gap.end) {
        continue;
      }

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
          input.task.deadlineTime
        ),
        dailyLoad,
        loadBand: Math.floor(dailyLoad.totalScheduledMinutes / 120)
      });
    }
  }

  candidates.sort(compareSuggestions);

  return selectDiverseSuggestions(candidates, input.maximumSuggestions ?? 3).map(
    ({ loadBand: _loadBand, ...suggestion }) => suggestion
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
  const start = localTimeToMinutes(event.startTime);
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
  const start = localTimeToMinutes(task.scheduledTime!);
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
  deadlineTime: LocalTimeString | null
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
    parts.push(
      deadlineTime === null
        ? `This time finishes by the end of the ${deadlineDate} deadline day.`
        : `This time finishes by the ${deadlineDate} at ${deadlineTime} deadline.`
    );
  }

  parts.push(
    dailyLoad.totalScheduledMinutes > 0
      ? `${formatMinutes(dailyLoad.totalScheduledMinutes)} is already scheduled that day.`
      : "No timed items with a known duration are already scheduled that day."
  );

  return parts.join(" ");
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

function minutesToTime(minutes: number): LocalTimeString {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(remaining).padStart(2, "0")}` as LocalTimeString;
}

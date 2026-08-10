import { CalendarEvent } from "../../types/calendarEvent";
import { LocalDateString, LocalTimeString } from "../../types/dateTime";
import { isTaskResolved, Task } from "../../types/task";

export type CalendarDaySchedule = {
  date: LocalDateString;
  fixedEvents: CalendarEvent[];
  plannedTasks: Task[];
  flexibleTasks: Task[];
  completedTaskCount: number;
  scheduledMinutes: number;
};

export function buildCalendarSchedule(
  startDate: LocalDateString,
  endDate: LocalDateString,
  events: CalendarEvent[],
  tasks: Task[]
): Map<LocalDateString, CalendarDaySchedule> {
  const schedule = new Map<LocalDateString, CalendarDaySchedule>();

  for (const event of events) {
    const day = getOrCreateDay(schedule, event.date);
    day.fixedEvents.push(event);
    day.scheduledMinutes += getEventDurationMinutes(event);
  }

  for (const task of tasks) {
    if (
      isTaskResolved(task) ||
      task.scheduledDate === null ||
      task.scheduledDate < startDate ||
      task.scheduledDate > endDate
    ) {
      continue;
    }

    const day = getOrCreateDay(schedule, task.scheduledDate);

    if (task.scheduledTime) {
      day.plannedTasks.push(task);
    } else {
      day.flexibleTasks.push(task);
    }

    if (task.status === "completed") {
      day.completedTaskCount += 1;
    }

    day.scheduledMinutes += task.estimatedDurationMinutes ?? 0;
  }

  for (const day of schedule.values()) {
    day.fixedEvents.sort((first, second) =>
      first.startTime.localeCompare(second.startTime)
    );
    day.plannedTasks.sort(compareTaskTimes);
    day.flexibleTasks.sort((first, second) =>
      first.createdAt.localeCompare(second.createdAt)
    );
  }

  return schedule;
}

export function createEmptyDay(date: LocalDateString): CalendarDaySchedule {
  return {
    date,
    fixedEvents: [],
    plannedTasks: [],
    flexibleTasks: [],
    completedTaskCount: 0,
    scheduledMinutes: 0
  };
}

export function getEventDurationMinutes(event: CalendarEvent): number {
  if (event.durationMinutes !== null) {
    return event.durationMinutes;
  }

  if (event.endTime === null) {
    return 0;
  }

  return Math.max(0, timeToMinutes(event.endTime) - timeToMinutes(event.startTime));
}

export function formatDuration(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) {
    return null;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

function getOrCreateDay(
  schedule: Map<LocalDateString, CalendarDaySchedule>,
  date: LocalDateString
): CalendarDaySchedule {
  const existingDay = schedule.get(date);

  if (existingDay) {
    return existingDay;
  }

  const day = createEmptyDay(date);
  schedule.set(date, day);

  return day;
}

function compareTaskTimes(first: Task, second: Task): number {
  const timeOrder = (first.scheduledTime ?? "").localeCompare(second.scheduledTime ?? "");

  return timeOrder || first.createdAt.localeCompare(second.createdAt);
}

function timeToMinutes(time: LocalTimeString): number {
  const [hours, minutes] = time.split(":").map(Number);

  return (hours ?? 0) * 60 + (minutes ?? 0);
}

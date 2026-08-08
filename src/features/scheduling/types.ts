import { CalendarEvent } from "../../types/calendarEvent";
import { LocalDateString, LocalTimeString } from "../../types/dateTime";
import { PlanningPreferences } from "../../types/settings";
import { Task } from "../../types/task";

export type DailyLoad = {
  date: LocalDateString;
  fixedCommitmentCount: number;
  fixedMinutes: number;
  scheduledTaskCount: number;
  taskMinutes: number;
  totalScheduledMinutes: number;
};

export type SchedulingSuggestion = {
  date: LocalDateString;
  startTime: LocalTimeString;
  endTime: LocalTimeString;
  durationMinutes: number;
  explanation: string;
  dailyLoad: DailyLoad;
};

export type SchedulingEngineInput = {
  task: Task;
  tasks: Task[];
  events: CalendarEvent[];
  preferences: PlanningPreferences;
  startDate: LocalDateString;
  horizonDays: number;
  now: Date;
  maximumSuggestions?: number;
};

export type SchedulingSearchResult = {
  task: Task;
  status: "ready" | "needs_duration" | "no_windows";
  suggestions: SchedulingSuggestion[];
  durationMinutes: number | null;
  horizonDays: number;
  searchedThrough: LocalDateString;
  preferences: PlanningPreferences;
};

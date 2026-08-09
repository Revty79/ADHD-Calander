import { LocalDateString } from "../../types/dateTime";
import { addDaysToLocalDate } from "../../utils/dates";

export type TaskDateQuickChoice = {
  label: string;
  value: LocalDateString | null;
};

export function getPlannedDateQuickChoices(
  referenceDate = new Date()
): TaskDateQuickChoice[] {
  return [
    { label: "Today", value: addDaysToLocalDate(0, referenceDate) },
    { label: "Tomorrow", value: addDaysToLocalDate(1, referenceDate) }
  ];
}

export function getDeadlineQuickChoices(
  referenceDate = new Date()
): TaskDateQuickChoice[] {
  return [
    { label: "No deadline", value: null },
    { label: "Today", value: addDaysToLocalDate(0, referenceDate) },
    { label: "Tomorrow", value: addDaysToLocalDate(1, referenceDate) },
    { label: "In 3 days", value: addDaysToLocalDate(3, referenceDate) },
    { label: "In 1 week", value: addDaysToLocalDate(7, referenceDate) }
  ];
}

import { LocalDateString, LocalTimeString } from "../../types/dateTime";

export type TaskDeadline = {
  deadlineDate: LocalDateString | null;
  deadlineTime: LocalTimeString | null;
};

export type TaskPlacement = {
  scheduledDate: LocalDateString;
  scheduledTime: LocalTimeString;
  estimatedDurationMinutes: number | null;
};

export function getDeadlineEndMinutesForDate(
  deadline: TaskDeadline,
  date: LocalDateString
): number | null {
  if (deadline.deadlineDate === null || date < deadline.deadlineDate) {
    return null;
  }

  if (date > deadline.deadlineDate) {
    return 0;
  }

  return deadline.deadlineTime === null
    ? 24 * 60
    : localTimeToMinutes(deadline.deadlineTime);
}

export function doesTaskPlacementMeetDeadline(
  placement: TaskPlacement,
  deadline: TaskDeadline
): boolean {
  const deadlineEnd = getDeadlineEndMinutesForDate(deadline, placement.scheduledDate);

  if (deadlineEnd === null) {
    return true;
  }

  const durationMinutes = placement.estimatedDurationMinutes ?? 0;

  return localTimeToMinutes(placement.scheduledTime) + durationMinutes <= deadlineEnd;
}

export function localTimeToMinutes(time: LocalTimeString): number {
  const [hours, minutes] = time.split(":").map(Number);

  return (hours ?? 0) * 60 + (minutes ?? 0);
}

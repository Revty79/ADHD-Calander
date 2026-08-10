import { LocalDateString, LocalTimeString } from "../types/task";

const localDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const localTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function getLocalDateString(date = new Date()): LocalDateString {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}` as LocalDateString;
}

export function getLocalTimeString(date = new Date()): LocalTimeString {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${hour}:${minute}` as LocalTimeString;
}

export function addDaysToLocalDate(
  days: number,
  referenceDate = new Date()
): LocalDateString {
  return getLocalDateString(
    new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate() + days
    )
  );
}

export function normalizeLocalDateInput(value: string): LocalDateString | null {
  const trimmedValue = value.trim();
  const match = localDatePattern.exec(trimmedValue);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day);

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return trimmedValue as LocalDateString;
}

export function normalizeOptionalTime(value?: string | null): LocalTimeString | null {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return null;
  }

  if (!localTimePattern.test(trimmedValue)) {
    return null;
  }

  return trimmedValue as LocalTimeString;
}

export function formatLocalDateForDisplay(value: LocalDateString): string {
  const match = localDatePattern.exec(value);

  if (!match) {
    return value;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(date);
}

export function formatLocalTimeForDisplay(value: LocalTimeString): string {
  const normalizedTime = normalizeOptionalTime(value);

  if (!normalizedTime) {
    return value;
  }

  const [hour, minute] = normalizedTime.split(":").map(Number);
  const date = new Date(2026, 0, 1, hour ?? 0, minute ?? 0);

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

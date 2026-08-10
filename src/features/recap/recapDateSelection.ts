import { LocalDateString } from "../../types/dateTime";
import { normalizeLocalDateInput } from "../../utils/dates";

export type RecapDateSelection =
  { ok: true; date: LocalDateString } | { ok: false; errorMessage: string };

export function selectRecapDate(
  value: string,
  today: LocalDateString
): RecapDateSelection {
  const normalizedDate = normalizeLocalDateInput(value);

  if (!normalizedDate) {
    return { ok: false, errorMessage: "Use a date in YYYY-MM-DD format." };
  }

  if (normalizedDate > today) {
    return { ok: false, errorMessage: "Choose today or an earlier date." };
  }

  return { ok: true, date: normalizedDate };
}

export function getRecapRouteDate(
  value: string | string[] | undefined,
  today: LocalDateString
): LocalDateString {
  const routeValue = Array.isArray(value) ? value[0] : value;
  const selection = selectRecapDate(routeValue ?? "", today);

  return selection.ok ? selection.date : today;
}

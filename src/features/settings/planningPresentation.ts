export const planningSettingsSummary =
  "Suggestions search seven days by default and never fill time without your confirmation.";

export function formatPlanningTime(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date(2026, 0, 1, hours ?? 0, minutes ?? 0);

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function formatTransitionBufferOption(value: number): string {
  return value === 0 ? "None" : `${value} min`;
}

export function formatSuggestedTaskTimeOption(value: number): string {
  return `${value / 60} hr`;
}

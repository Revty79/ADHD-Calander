import { LocalTimeString, PlannedTimePreference } from "../../types/task";

export const plannedTimePreferenceOptions: {
  label: string;
  value: PlannedTimePreference;
}[] = [
  { label: "Anytime", value: "anytime" },
  { label: "Morning", value: "morning" },
  { label: "Afternoon", value: "afternoon" },
  { label: "Evening", value: "evening" }
];

export const plannedTimePreferenceRanges: Record<
  Exclude<PlannedTimePreference, "anytime">,
  { start: LocalTimeString; end: LocalTimeString }
> = {
  morning: { start: "06:00", end: "12:00" },
  afternoon: { start: "12:00", end: "17:00" },
  evening: { start: "17:00", end: "21:00" }
};

export function getPlannedTimePreferenceLabel(preference: PlannedTimePreference): string {
  return (
    plannedTimePreferenceOptions.find((option) => option.value === preference)?.label ??
    "Anytime"
  );
}

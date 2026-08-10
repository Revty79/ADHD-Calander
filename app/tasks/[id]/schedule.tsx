import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ErrorNotice } from "../../../src/components/ErrorNotice";
import { Screen } from "../../../src/components/Screen";
import {
  practicalDurationOptions,
  useSchedulingSuggestions
} from "../../../src/features/scheduling/hooks/useSchedulingSuggestions";
import { SchedulingSuggestion } from "../../../src/features/scheduling/types";
import { getTaskDeadlineLabel } from "../../../src/features/tasks/taskPresentation";
import { formatLocalDateForDisplay } from "../../../src/utils/dates";

export default function ScheduleTaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const taskId = typeof params.id === "string" ? params.id : "";
  const scheduling = useSchedulingSuggestions(taskId);
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<SchedulingSuggestion | null>(null);
  const selectedDuration =
    scheduling.durationOverride ?? scheduling.result?.durationMinutes ?? null;

  function chooseDuration(durationMinutes: number) {
    setSelectedSuggestion(null);
    scheduling.chooseDuration(durationMinutes);
  }

  async function confirmSchedule() {
    if (!selectedSuggestion) {
      return;
    }

    const task = await scheduling.acceptSuggestion(selectedSuggestion);

    if (task?.scheduledDate) {
      router.replace({
        pathname: "/tasks/[id]",
        params: { id: task.id }
      });
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.kicker}>Rule-based scheduling</Text>
        <Text style={styles.title}>Help me schedule</Text>
        <Text style={styles.intro}>
          Review a few conservative openings. Nothing changes until you confirm one.
        </Text>
      </View>

      {scheduling.isLoading && !scheduling.result ? (
        <View style={styles.loading}>
          <ActivityIndicator accessibilityLabel="Finding scheduling suggestions" />
          <Text style={styles.muted}>Looking for comfortable openings...</Text>
        </View>
      ) : null}

      {scheduling.errorMessage ? (
        <ErrorNotice message={scheduling.errorMessage} onRetry={scheduling.refresh} />
      ) : null}

      {scheduling.result ? (
        <>
          <View style={styles.taskPanel}>
            <Text style={styles.taskTitle}>{scheduling.result.task.title}</Text>
            {scheduling.result.task.description ? (
              <Text style={styles.taskDescription}>
                {scheduling.result.task.description}
              </Text>
            ) : null}
            {scheduling.result.task.deadlineDate ? (
              <Text style={styles.meta}>
                Deadline: {getTaskDeadlineLabel(scheduling.result.task)}
              </Text>
            ) : null}
            <Text style={styles.meta}>
              Planning hours {formatTime(scheduling.result.preferences.planningDayStart)}–
              {formatTime(scheduling.result.preferences.planningDayEnd)} · Fixed-event
              buffer {scheduling.result.preferences.transitionBufferMinutes} min
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How long might this take?</Text>
            <Text style={styles.sectionHelp}>
              Choose a practical estimate. You can try another estimate without changing
              the task yet.
            </Text>
            <View style={styles.durationOptions}>
              {practicalDurationOptions.map((duration) => {
                const isSelected = selectedDuration === duration;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Use a ${formatDuration(duration)} estimate`}
                    accessibilityState={{ selected: isSelected }}
                    key={duration}
                    onPress={() => chooseDuration(duration)}
                    style={({ pressed }) => [
                      styles.durationButton,
                      isSelected && styles.durationButtonSelected,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text
                      style={[
                        styles.durationButtonText,
                        isSelected && styles.durationButtonTextSelected
                      ]}
                    >
                      {formatDuration(duration)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {scheduling.result.status === "needs_duration" ? (
            <View accessibilityRole="summary" style={styles.messagePanel}>
              <Text style={styles.messageTitle}>Add an estimated duration</Text>
              <Text style={styles.messageText}>
                Choose an estimate so the scheduler can look for a time that fits fully.
              </Text>
            </View>
          ) : null}

          {scheduling.result.status === "no_windows" ? (
            <View accessibilityRole="summary" style={styles.messagePanel}>
              <Text style={styles.messageTitle}>No comfortable opening found</Text>
              <Text style={styles.messageText}>
                I couldn&apos;t find an opening within these planning rules through{" "}
                {formatLocalDateForDisplay(scheduling.result.searchedThrough)}. The task
                is still unscheduled.
              </Text>
              <View style={styles.messageActions}>
                {scheduling.horizonDays < 14 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setSelectedSuggestion(null);
                      scheduling.lookFartherAhead();
                    }}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Look 14 days ahead</Text>
                  </Pressable>
                ) : null}
                <Text style={styles.messageText}>
                  You can also try a shorter estimate or leave it unscheduled.
                </Text>
              </View>
            </View>
          ) : null}

          {scheduling.result.status === "ready" ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Suggested times</Text>
              <Text style={styles.sectionHelp}>
                These options fit the full estimate without overlapping fixed events or
                timed tasks.
              </Text>
              <View style={styles.suggestionList}>
                {scheduling.result.suggestions.map((suggestion) => {
                  const isSelected = sameSuggestion(selectedSuggestion, suggestion);

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Suggested time: ${formatLocalDateForDisplay(
                        suggestion.date
                      )}, ${formatTime(suggestion.startTime)} to ${formatTime(
                        suggestion.endTime
                      )}. ${suggestion.explanation}`}
                      accessibilityState={{ selected: isSelected }}
                      key={`${suggestion.date}-${suggestion.startTime}`}
                      onPress={() => setSelectedSuggestion(suggestion)}
                      style={({ pressed }) => [
                        styles.suggestionCard,
                        isSelected && styles.suggestionCardSelected,
                        pressed && styles.pressed
                      ]}
                    >
                      <Text style={styles.suggestionDate}>
                        {formatLocalDateForDisplay(suggestion.date)}
                      </Text>
                      <Text style={styles.suggestionTime}>
                        {formatTime(suggestion.startTime)}–
                        {formatTime(suggestion.endTime)}
                      </Text>
                      <Text style={styles.suggestionExplanation}>
                        {suggestion.explanation}
                      </Text>
                      <Text style={styles.selectLabel}>
                        {isSelected ? "Selected" : "Choose this time"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {selectedSuggestion ? (
            <View accessibilityRole="summary" style={styles.confirmPanel}>
              <Text style={styles.confirmTitle}>Confirm this placement?</Text>
              <Text style={styles.confirmText}>
                {formatLocalDateForDisplay(selectedSuggestion.date)},{" "}
                {formatTime(selectedSuggestion.startTime)}–
                {formatTime(selectedSuggestion.endTime)}
              </Text>
              <Text style={styles.confirmText}>
                This updates the existing task. It does not create another task or event.
              </Text>
              <View style={styles.confirmActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Confirm scheduling this task"
                  disabled={scheduling.isAccepting}
                  onPress={confirmSchedule}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed,
                    scheduling.isAccepting && styles.disabled
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {scheduling.isAccepting ? "Scheduling..." : "Confirm schedule"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={scheduling.isAccepting}
                  onPress={() => setSelectedSuggestion(null)}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.pressed
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>Keep looking</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      <Link href={{ pathname: "/tasks/[id]", params: { id: taskId } }} asChild>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.leaveLink, pressed && styles.pressed]}
        >
          <Text style={styles.leaveLinkText}>Back to task</Text>
        </Pressable>
      </Link>
    </Screen>
  );
}

function sameSuggestion(
  first: SchedulingSuggestion | null,
  second: SchedulingSuggestion
): boolean {
  return (
    first?.date === second.date &&
    first.startTime === second.startTime &&
    first.endTime === second.endTime
  );
}

function formatDuration(minutes: number): string {
  return minutes === 120 ? "2 hr" : `${minutes} min`;
}

function formatTime(value: string): string {
  const [hourValue, minuteValue] = value.split(":").map(Number);
  const hour = hourValue ?? 0;
  const minute = minuteValue ?? 0;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

const styles = StyleSheet.create({
  header: { gap: 6, marginBottom: 20 },
  kicker: {
    color: "#68645e",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: { color: "#2f2d2a", fontSize: 28, fontWeight: "800" },
  intro: { color: "#4a4742", fontSize: 16, lineHeight: 23 },
  loading: { alignItems: "center", gap: 8, paddingVertical: 32 },
  muted: { color: "#68645e", fontSize: 15 },
  taskPanel: {
    backgroundColor: "#eef2ed",
    borderColor: "#9fb6ad",
    borderRadius: 10,
    borderWidth: 1,
    gap: 7,
    marginBottom: 22,
    padding: 16
  },
  taskTitle: { color: "#263f38", fontSize: 20, fontWeight: "800" },
  taskDescription: { color: "#40544c", fontSize: 15, lineHeight: 21 },
  meta: { color: "#4f5c54", fontSize: 13, lineHeight: 19 },
  section: { gap: 10, marginBottom: 24 },
  sectionTitle: { color: "#2f2d2a", fontSize: 19, fontWeight: "800" },
  sectionHelp: { color: "#68645e", fontSize: 14, lineHeight: 20 },
  durationOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  durationButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#9b948a",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 68,
    paddingHorizontal: 14
  },
  durationButtonSelected: { backgroundColor: "#2f5d62", borderColor: "#2f5d62" },
  durationButtonText: { color: "#4a4742", fontSize: 14, fontWeight: "700" },
  durationButtonTextSelected: { color: "#ffffff" },
  messagePanel: {
    backgroundColor: "#ffffff",
    borderColor: "#ded9cf",
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginBottom: 24,
    padding: 16
  },
  messageTitle: { color: "#2f2d2a", fontSize: 18, fontWeight: "800" },
  messageText: { color: "#4a4742", fontSize: 15, lineHeight: 22 },
  messageActions: { alignItems: "flex-start", gap: 10, marginTop: 4 },
  suggestionList: { gap: 12 },
  suggestionCard: {
    backgroundColor: "#ffffff",
    borderColor: "#cfc8bd",
    borderRadius: 10,
    borderWidth: 1,
    gap: 7,
    minHeight: 48,
    padding: 16
  },
  suggestionCardSelected: { backgroundColor: "#eef2ed", borderColor: "#2f5d62" },
  suggestionDate: { color: "#2f2d2a", fontSize: 17, fontWeight: "800" },
  suggestionTime: { color: "#24565c", fontSize: 20, fontWeight: "800" },
  suggestionExplanation: { color: "#4a4742", fontSize: 14, lineHeight: 21 },
  selectLabel: { color: "#24565c", fontSize: 14, fontWeight: "800", marginTop: 3 },
  confirmPanel: {
    backgroundColor: "#fff7dc",
    borderColor: "#d5bd72",
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginBottom: 22,
    padding: 16
  },
  confirmTitle: { color: "#3f3827", fontSize: 19, fontWeight: "800" },
  confirmText: { color: "#544b34", fontSize: 15, lineHeight: 21 },
  confirmActions: { gap: 10, marginTop: 6 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2f5d62",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16
  },
  primaryButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#2f5d62",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14
  },
  secondaryButtonText: { color: "#24565c", fontSize: 14, fontWeight: "800" },
  leaveLink: { alignItems: "center", minHeight: 48, padding: 12 },
  leaveLinkText: {
    color: "#24565c",
    fontSize: 15,
    fontWeight: "800",
    textDecorationLine: "underline"
  },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.7 }
});

import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { ErrorNotice } from "../../src/components/ErrorNotice";
import { Screen } from "../../src/components/Screen";
import { addLocalDays } from "../../src/features/calendar/calendarDates";
import { useDailyRecap } from "../../src/features/recap/hooks/useDailyRecap";
import {
  formatCompletionTime,
  formatEventTime,
  formatRecoveryDecision,
  getOpenReasonLabel
} from "../../src/features/recap/recapPresentation";
import { recapRecoveryDecisionTypes } from "../../src/types/recap";
import { LocalDateString } from "../../src/types/dateTime";
import {
  formatLocalDateForDisplay,
  getLocalDateString,
  normalizeLocalDateInput
} from "../../src/utils/dates";

export default function RecapScreen() {
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const today = useMemo(() => getLocalDateString(), []);
  const routeDate = getRouteDate(params.date, today);

  return <RecapContent initialDate={routeDate} key={routeDate} today={today} />;
}

function RecapContent({
  initialDate,
  today
}: {
  initialDate: LocalDateString;
  today: LocalDateString;
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [dateInput, setDateInput] = useState<string>(initialDate);
  const [dateError, setDateError] = useState<string | null>(null);
  const { recap, isLoading, errorMessage, refresh } = useDailyRecap(selectedDate);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const chooseDate = useCallback(
    (date: string) => {
      const normalizedDate = normalizeLocalDateInput(date);

      if (!normalizedDate) {
        setDateError("Use a date in YYYY-MM-DD format.");
        return;
      }

      if (normalizedDate > today) {
        setDateError("Choose today or an earlier date.");
        return;
      }

      setDateError(null);
      setSelectedDate(normalizedDate);
      setDateInput(normalizedDate);
    },
    [today]
  );

  const nextDate = addLocalDays(selectedDate, 1);
  const hasTaskActivity =
    (recap?.accomplishedTasks.length ?? 0) +
      (recap?.stillOpenTasks.length ?? 0) +
      (recap?.recovery.totalDecisionCount ?? 0) +
      (recap?.recovery.waitingDecisionCount ?? 0) >
    0;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.kicker}>Daily Recap</Text>
        <Text style={styles.title}>{formatLocalDateForDisplay(selectedDate)}</Text>
        <Text style={styles.intro}>
          A factual look at completed work and how the plan changed.
        </Text>
      </View>

      <View style={styles.datePanel}>
        <View style={styles.dateActions}>
          <Pressable
            accessibilityLabel="Show previous day's recap"
            accessibilityRole="button"
            onPress={() => chooseDate(addLocalDays(selectedDate, -1))}
            style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
          >
            <Text style={styles.dateButtonText}>Previous</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Show next day's recap"
            accessibilityRole="button"
            accessibilityState={{ disabled: nextDate > today }}
            disabled={nextDate > today}
            onPress={() => chooseDate(nextDate)}
            style={({ pressed }) => [
              styles.dateButton,
              nextDate > today && styles.disabled,
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.dateButtonText}>Next</Text>
          </Pressable>
        </View>
        <View style={styles.dateEntry}>
          <Text style={styles.inputLabel}>Review another date</Text>
          <View style={styles.dateInputRow}>
            <TextInput
              accessibilityLabel="Recap date in year month day format"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setDateInput}
              onSubmitEditing={() => chooseDate(dateInput)}
              placeholder="YYYY-MM-DD"
              returnKeyType="go"
              style={styles.dateInput}
              value={dateInput}
            />
            <Pressable
              accessibilityLabel="View recap for entered date"
              accessibilityRole="button"
              onPress={() => chooseDate(dateInput)}
              style={({ pressed }) => [styles.viewButton, pressed && styles.pressed]}
            >
              <Text style={styles.viewButtonText}>View</Text>
            </Pressable>
          </View>
          {dateError ? (
            <Text accessibilityRole="alert" style={styles.validationText}>
              {dateError}
            </Text>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator accessibilityLabel="Loading daily recap" />
          <Text style={styles.mutedText}>Loading recap...</Text>
        </View>
      ) : null}

      {errorMessage ? <ErrorNotice message={errorMessage} onRetry={refresh} /> : null}

      {!isLoading && !errorMessage && recap ? (
        <>
          <View style={[styles.section, styles.accomplishedSection]}>
            <View style={styles.sectionHeading}>
              <Text style={styles.accomplishedTitle}>Accomplished</Text>
              <Text style={styles.factCount}>
                {recap.accomplishedTasks.length}{" "}
                {recap.accomplishedTasks.length === 1 ? "task" : "tasks"}
              </Text>
            </View>
            <Text style={styles.encouragement}>{recap.encouragement}</Text>
            {recap.completedEstimatedMinutes > 0 ? (
              <Text style={styles.estimateSummary}>
                {recap.completedEstimatedMinutes} estimated minutes among completed tasks.
              </Text>
            ) : null}
            {recap.accomplishedTasks.length === 0 ? (
              <View style={styles.accomplishedEmpty}>
                <Text style={styles.mutedText}>
                  {hasTaskActivity
                    ? "No tasks are recorded as completed on this date yet."
                    : "No task activity was recorded for this date."}
                </Text>
              </View>
            ) : (
              <View style={styles.cardList}>
                {recap.accomplishedTasks.map((task) => (
                  <View key={task.id} style={styles.accomplishedCard}>
                    <Text style={styles.cardTitle}>{task.title}</Text>
                    <Text style={styles.cardMeta}>
                      Completed at {formatCompletionTime(task.completedAt!)}
                      {task.estimatedDurationMinutes
                        ? ` - ${task.estimatedDurationMinutes} min estimate`
                        : ""}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {recap.fixedEvents.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>On your calendar</Text>
              <View style={styles.cardList}>
                {recap.fixedEvents.map((event) => (
                  <View key={event.id} style={styles.eventCard}>
                    <Text style={styles.eventTime}>{formatEventTime(event)}</Text>
                    <View style={styles.cardCopy}>
                      <Text style={styles.cardTitle}>{event.title}</Text>
                      <Text style={styles.cardMeta}>Fixed calendar commitment</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {recap.recovery.sessionCount > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {recap.recovery.totalDecisionCount > 0
                  ? "Plan adjusted"
                  : "Recovery review"}
              </Text>
              <View style={styles.adjustmentCard}>
                {recapRecoveryDecisionTypes.map((decision) => {
                  const count = recap.recovery.decisionCounts[decision];

                  return count > 0 ? (
                    <Text key={decision} style={styles.adjustmentText}>
                      {formatRecoveryDecision(decision, count)}
                    </Text>
                  ) : null;
                })}
                {recap.recovery.waitingDecisionCount > 0 ? (
                  <Text style={styles.waitingText}>
                    {recap.recovery.waitingDecisionCount}{" "}
                    {recap.recovery.waitingDecisionCount === 1
                      ? "task is waiting for a decision"
                      : "tasks are waiting for a decision"}
                  </Text>
                ) : null}
                {recap.recovery.totalDecisionCount === 0 &&
                recap.recovery.waitingDecisionCount === 0 ? (
                  <Text style={styles.mutedText}>
                    A Recovery review was opened with no task decisions needed.
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {recap.stillOpenTasks.length > 0 ? (
            <View style={[styles.section, styles.openSection]}>
              <Text style={styles.openTitle}>Still open</Text>
              <Text style={styles.openIntro}>
                These remain active. They are shown here as context, not a score.
              </Text>
              <View style={styles.cardList}>
                {recap.stillOpenTasks.map(({ task, reason }) => (
                  <View key={task.id} style={styles.openCard}>
                    <Text style={styles.openTaskTitle}>{task.title}</Text>
                    <Text style={styles.cardMeta}>{getOpenReasonLabel(reason)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function getRouteDate(
  value: string | string[] | undefined,
  today: ReturnType<typeof getLocalDateString>
) {
  const routeValue = Array.isArray(value) ? value[0] : value;
  const normalizedDate = routeValue ? normalizeLocalDateInput(routeValue) : null;

  return normalizedDate && normalizedDate <= today ? normalizedDate : today;
}

const styles = StyleSheet.create({
  header: {
    gap: 6,
    marginBottom: 20
  },
  kicker: {
    color: "#68645e",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  title: {
    color: "#2f2d2a",
    fontSize: 28,
    fontWeight: "800"
  },
  intro: {
    color: "#56524c",
    fontSize: 15,
    lineHeight: 22
  },
  datePanel: {
    backgroundColor: "#ffffff",
    borderColor: "#ded9cf",
    borderRadius: 10,
    borderWidth: 1,
    gap: 16,
    marginBottom: 24,
    padding: 16
  },
  dateActions: {
    flexDirection: "row",
    gap: 12
  },
  dateButton: {
    alignItems: "center",
    borderColor: "#42737a",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 12
  },
  dateButtonText: {
    color: "#24565c",
    fontSize: 15,
    fontWeight: "800"
  },
  dateEntry: {
    gap: 7
  },
  inputLabel: {
    color: "#46423d",
    fontSize: 14,
    fontWeight: "700"
  },
  dateInputRow: {
    flexDirection: "row",
    gap: 10
  },
  dateInput: {
    backgroundColor: "#ffffff",
    borderColor: "#aaa49a",
    borderRadius: 8,
    borderWidth: 1,
    color: "#2f2d2a",
    flex: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12
  },
  viewButton: {
    alignItems: "center",
    backgroundColor: "#2f5d62",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 72,
    paddingHorizontal: 16
  },
  viewButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800"
  },
  validationText: {
    color: "#873e35",
    fontSize: 14
  },
  centered: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 32
  },
  section: {
    gap: 12,
    marginBottom: 26
  },
  accomplishedSection: {
    backgroundColor: "#eef2ed",
    borderColor: "#b7c8bd",
    borderRadius: 12,
    borderWidth: 1,
    padding: 18
  },
  sectionHeading: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  accomplishedTitle: {
    color: "#263f38",
    fontSize: 23,
    fontWeight: "800"
  },
  factCount: {
    color: "#4f5c54",
    fontSize: 14,
    fontWeight: "700"
  },
  encouragement: {
    color: "#344b43",
    fontSize: 16,
    lineHeight: 23
  },
  estimateSummary: {
    color: "#526058",
    fontSize: 13,
    lineHeight: 19
  },
  accomplishedEmpty: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 15
  },
  sectionTitle: {
    color: "#2f2d2a",
    fontSize: 20,
    fontWeight: "800"
  },
  cardList: {
    gap: 10
  },
  accomplishedCard: {
    backgroundColor: "#ffffff",
    borderColor: "#c9d7ce",
    borderLeftColor: "#4e7c70",
    borderLeftWidth: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 15
  },
  cardTitle: {
    color: "#2f2d2a",
    fontSize: 16,
    fontWeight: "700"
  },
  cardMeta: {
    color: "#68645e",
    fontSize: 13,
    lineHeight: 19
  },
  eventCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d9d4ca",
    borderLeftColor: "#6f9387",
    borderLeftWidth: 5,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 15
  },
  eventTime: {
    color: "#2f5d62",
    fontSize: 14,
    fontWeight: "800"
  },
  cardCopy: {
    flex: 1,
    gap: 4
  },
  adjustmentCard: {
    backgroundColor: "#ffffff",
    borderColor: "#d9d4ca",
    borderRadius: 10,
    borderWidth: 1,
    gap: 9,
    padding: 16
  },
  adjustmentText: {
    color: "#344b43",
    fontSize: 15,
    lineHeight: 21
  },
  waitingText: {
    color: "#5f5a54",
    fontSize: 14,
    lineHeight: 20
  },
  openSection: {
    borderTopColor: "#ded9cf",
    borderTopWidth: 1,
    paddingTop: 20
  },
  openTitle: {
    color: "#55514b",
    fontSize: 18,
    fontWeight: "700"
  },
  openIntro: {
    color: "#6b665f",
    fontSize: 14,
    lineHeight: 20
  },
  openCard: {
    backgroundColor: "#f4f2ed",
    borderColor: "#ddd8cf",
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 14
  },
  openTaskTitle: {
    color: "#4e4a45",
    fontSize: 15,
    fontWeight: "700"
  },
  mutedText: {
    color: "#68645e",
    fontSize: 15,
    lineHeight: 22
  },
  disabled: {
    opacity: 0.45
  },
  pressed: {
    opacity: 0.72
  }
});

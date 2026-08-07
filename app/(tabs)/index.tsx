import { Link, useFocusEffect } from "expo-router";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ErrorNotice } from "../../src/components/ErrorNotice";
import { Screen } from "../../src/components/Screen";
import { TaskList } from "../../src/features/tasks/components/TaskList";
import { useTodayPlan } from "../../src/features/today/hooks/useTodayPlan";
import { CalendarEvent } from "../../src/types/calendarEvent";
import { isTaskActive, isTaskCompleted } from "../../src/types/task";
import { formatLocalDateForDisplay, getLocalDateString } from "../../src/utils/dates";

export default function TodayScreen() {
  const today = useMemo(() => getLocalDateString(), []);
  const {
    tasks,
    fixedEvents,
    isLoading,
    errorMessage,
    refresh,
    completeTask,
    undoCompletion
  } = useTodayPlan(today);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const activeTasks = tasks.filter(isTaskActive);
  const plannedTasks = activeTasks.filter((task) => task.scheduledTime !== null);
  const flexibleTasks = activeTasks.filter((task) => task.scheduledTime === null);
  const completedTasks = tasks.filter(isTaskCompleted);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Today</Text>
          <Text style={styles.date}>{formatLocalDateForDisplay(today)}</Text>
        </View>
        <Link
          href={{
            pathname: "/tasks/new",
            params: { scheduledDate: today, returnTo: "today" }
          }}
          asChild
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a task for today"
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </Link>
      </View>

      <Link href={{ pathname: "/recovery", params: { sourceDate: today } }} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Recovery Mode for today"
          style={({ pressed }) => [styles.recoveryCallout, pressed && styles.pressed]}
        >
          <View style={styles.recoveryCopy}>
            <Text style={styles.recoveryTitle}>Today got away from me</Text>
            <Text style={styles.recoveryText}>
              Review unfinished tasks without moving fixed appointments.
            </Text>
          </View>
          <Text style={styles.recoveryArrow}>Open</Text>
        </Pressable>
      </Link>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator accessibilityLabel="Loading today's plan" />
          <Text style={styles.mutedText}>Loading today...</Text>
        </View>
      ) : null}

      {errorMessage ? <ErrorNotice message={errorMessage} onRetry={refresh} /> : null}

      {!isLoading && !errorMessage ? (
        <>
          <FixedEventList events={fixedEvents} />
          <TaskList
            title="Planned tasks"
            emptyMessage="No tasks have a set time today."
            tasks={plannedTasks}
            actionLabel="Complete"
            onAction={completeTask}
          />
          <TaskList
            title="Flexible tasks"
            emptyMessage="No flexible tasks are scheduled for today."
            tasks={flexibleTasks}
            actionLabel="Complete"
            onAction={completeTask}
          />
          <TaskList
            title="Completed"
            emptyMessage="Completed tasks will appear here."
            tasks={completedTasks}
            actionLabel="Undo"
            onAction={undoCompletion}
          />
        </>
      ) : null}
    </Screen>
  );
}

function FixedEventList({ events }: { events: CalendarEvent[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Fixed appointments</Text>
      {events.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.mutedText}>No fixed appointments today.</Text>
        </View>
      ) : (
        <View style={styles.eventList}>
          {events.map((event) => (
            <View key={event.id} style={styles.eventCard}>
              <Text style={styles.eventTime}>
                {event.startTime}
                {event.endTime ? `–${event.endTime}` : ""}
              </Text>
              <View style={styles.eventCopy}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.fixedLabel}>Fixed</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
    marginBottom: 16
  },
  headerText: {
    flex: 1,
    gap: 4
  },
  kicker: {
    color: "#68645e",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  date: {
    color: "#2f2d2a",
    fontSize: 24,
    fontWeight: "700"
  },
  addButton: {
    alignItems: "center",
    backgroundColor: "#2f5d62",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 72,
    paddingHorizontal: 18
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  recoveryCallout: {
    alignItems: "center",
    backgroundColor: "#eef2ed",
    borderColor: "#9fb6ad",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    minHeight: 64,
    padding: 15
  },
  recoveryCopy: {
    flex: 1,
    gap: 3
  },
  recoveryTitle: {
    color: "#263f38",
    fontSize: 16,
    fontWeight: "800"
  },
  recoveryText: {
    color: "#4f5c54",
    fontSize: 13,
    lineHeight: 19
  },
  recoveryArrow: {
    color: "#24565c",
    fontSize: 14,
    fontWeight: "800"
  },
  centered: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 32
  },
  mutedText: {
    color: "#68645e",
    fontSize: 15,
    lineHeight: 22
  },
  section: {
    gap: 10,
    marginBottom: 24
  },
  sectionTitle: {
    color: "#2f2d2a",
    fontSize: 19,
    fontWeight: "700"
  },
  emptyState: {
    backgroundColor: "#ffffff",
    borderColor: "#ded9cf",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16
  },
  eventList: {
    gap: 10
  },
  eventCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#8ea9a0",
    borderLeftWidth: 5,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 14
  },
  eventTime: {
    color: "#2f5d62",
    fontSize: 14,
    fontWeight: "800"
  },
  eventCopy: {
    flex: 1,
    gap: 3
  },
  eventTitle: {
    color: "#2f2d2a",
    fontSize: 16,
    fontWeight: "700"
  },
  fixedLabel: {
    color: "#68645e",
    fontSize: 12,
    textTransform: "uppercase"
  },
  pressed: {
    opacity: 0.75
  }
});

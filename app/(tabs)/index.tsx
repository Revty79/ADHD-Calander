import { Link, useFocusEffect } from "expo-router";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ErrorNotice } from "../../src/components/ErrorNotice";
import { Screen } from "../../src/components/Screen";
import { TaskList } from "../../src/features/tasks/components/TaskList";
import { useTasksForDate } from "../../src/features/tasks/hooks/useTasksForDate";
import { formatLocalDateForDisplay, getLocalDateString } from "../../src/utils/dates";

export default function TodayScreen() {
  const today = useMemo(() => getLocalDateString(), []);
  const { tasks, isLoading, errorMessage, refresh, completeTask, undoCompletion } =
    useTasksForDate(today);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const incompleteTasks = tasks.filter((task) => task.status !== "completed");
  const completedTasks = tasks.filter((task) => task.status === "completed");

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

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator accessibilityLabel="Loading today's tasks" />
          <Text style={styles.mutedText}>Loading tasks...</Text>
        </View>
      ) : null}

      {errorMessage ? <ErrorNotice message={errorMessage} onRetry={refresh} /> : null}

      {!isLoading && !errorMessage ? (
        <>
          <TaskList
            title="Open"
            emptyMessage="No tasks are scheduled for today."
            tasks={incompleteTasks}
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

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
    marginBottom: 20
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
  centered: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 32
  },
  mutedText: {
    color: "#68645e",
    fontSize: 15
  },
  pressed: {
    opacity: 0.75
  }
});

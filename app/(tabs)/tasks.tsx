import { Link, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ErrorNotice } from "../../src/components/ErrorNotice";
import { Screen } from "../../src/components/Screen";
import { TaskList } from "../../src/features/tasks/components/TaskList";
import { useAllTasks } from "../../src/features/tasks/hooks/useAllTasks";
import { isTaskActive, isTaskCompleted, isTaskResolved } from "../../src/types/task";

export default function TasksScreen() {
  const { tasks, isLoading, errorMessage, refresh, completeTask, undoCompletion } =
    useAllTasks();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const openTasks = tasks.filter(isTaskActive);
  const completedTasks = tasks.filter(isTaskCompleted);
  const resolvedTasks = tasks.filter(isTaskResolved);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <Link
          href={{
            pathname: "/tasks/new",
            params: { returnTo: "tasks" }
          }}
          asChild
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a task"
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </Link>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator accessibilityLabel="Loading tasks" />
          <Text style={styles.mutedText}>Loading tasks...</Text>
        </View>
      ) : null}

      {errorMessage ? <ErrorNotice message={errorMessage} onRetry={refresh} /> : null}

      {!isLoading && !errorMessage ? (
        <>
          <TaskList
            title="Open tasks"
            emptyMessage="No open tasks yet."
            tasks={openTasks}
            actionLabel="Complete"
            onAction={completeTask}
            showDate
          />
          <TaskList
            title="Completed"
            emptyMessage="Completed tasks will appear here."
            tasks={completedTasks}
            actionLabel="Undo"
            onAction={undoCompletion}
            showDate
          />
          <TaskList
            title="Resolved in Recovery Mode"
            emptyMessage="Recovery decisions will appear here."
            tasks={resolvedTasks}
            showDate
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
  title: {
    color: "#2f2d2a",
    flex: 1,
    fontSize: 28,
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

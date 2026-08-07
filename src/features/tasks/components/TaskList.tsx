import { Pressable, StyleSheet, Text, View } from "react-native";

import { Task } from "../../../types/task";
import { formatLocalDateForDisplay } from "../../../utils/dates";

type TaskListProps = {
  title: string;
  emptyMessage: string;
  tasks: Task[];
  actionLabel?: string;
  onAction?(id: string): void;
  showDate?: boolean;
};

export function TaskList({
  title,
  emptyMessage,
  tasks,
  actionLabel,
  onAction,
  showDate = false
}: TaskListProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {tasks.map((task) => (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.taskContent}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                {task.description ? (
                  <Text style={styles.taskDescription}>{task.description}</Text>
                ) : null}
                <View style={styles.metaRow}>
                  {showDate ? (
                    <Text style={styles.metaText}>
                      {task.scheduledDate
                        ? formatLocalDateForDisplay(task.scheduledDate)
                        : "Unscheduled"}
                    </Text>
                  ) : null}
                  {task.scheduledTime ? (
                    <Text style={styles.metaText}>{task.scheduledTime}</Text>
                  ) : null}
                  {task.estimatedDurationMinutes ? (
                    <Text style={styles.metaText}>
                      {task.estimatedDurationMinutes} min estimate
                    </Text>
                  ) : null}
                  <Text style={styles.metaText}>{getTaskStatusLabel(task.status)}</Text>
                </View>
              </View>
              {actionLabel && onAction ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${actionLabel} ${task.title}`}
                  onPress={() => onAction(task.id)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.pressed
                  ]}
                >
                  <Text style={styles.actionButtonText}>{actionLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function getTaskStatusLabel(status: Task["status"]): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "delegated":
      return "Delegated";
    case "removed":
      return "Removed from active tasks";
    case "broken_down":
      return "Broken into smaller tasks";
    default:
      return "Not started";
  }
}

const styles = StyleSheet.create({
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
  emptyText: {
    color: "#68645e",
    fontSize: 15,
    lineHeight: 22
  },
  list: {
    gap: 10
  },
  taskCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#ded9cf",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14
  },
  taskContent: {
    flex: 1,
    gap: 6
  },
  taskTitle: {
    color: "#2f2d2a",
    fontSize: 17,
    fontWeight: "700"
  },
  taskDescription: {
    color: "#4a4742",
    fontSize: 15,
    lineHeight: 21
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metaText: {
    color: "#68645e",
    fontSize: 13
  },
  actionButton: {
    alignItems: "center",
    borderColor: "#2f5d62",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 84,
    paddingHorizontal: 12
  },
  actionButtonText: {
    color: "#2f5d62",
    fontSize: 14,
    fontWeight: "700"
  },
  pressed: {
    opacity: 0.65
  }
});

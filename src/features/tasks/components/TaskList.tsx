import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatReminders } from "../../../notifications/reminderRules";
import { isTaskActive, Task } from "../../../types/task";
import { getItemColorOption } from "../../../types/itemColor";
import {
  formatLocalDateForDisplay,
  formatLocalTimeForDisplay
} from "../../../utils/dates";
import {
  getTaskDeadlineLabel,
  getTaskImportanceLabel,
  getTaskPlanningLabel,
  getTaskPreferredTimeLabel,
  getTaskStatusLabel,
  getTaskTimingNote
} from "../taskPresentation";

type TaskListProps = {
  title: string;
  emptyMessage: string;
  tasks: Task[];
  actionLabel?: string;
  onAction?(id: string): void;
  onPause?(id: string): void;
  onSchedule?(id: string): void;
  onStart?(id: string): void;
  showDate?: boolean;
};

export function TaskList({
  title,
  emptyMessage,
  tasks,
  actionLabel,
  onAction,
  onPause,
  onSchedule,
  onStart,
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
            <View
              key={task.id}
              style={[
                styles.taskCard,
                {
                  backgroundColor: getItemColorOption(task.color).backgroundColor,
                  borderLeftColor: getItemColorOption(task.color).borderColor
                }
              ]}
            >
              <View style={styles.taskContent}>
                <Link
                  accessibilityLabel={`Open ${task.title}`}
                  href={{ pathname: "/tasks/[id]", params: { id: task.id } }}
                  style={styles.taskTitle}
                >
                  {task.title}
                </Link>
                {task.description ? (
                  <Text style={styles.taskDescription}>{task.description}</Text>
                ) : null}
                <View style={styles.metaRow}>
                  {showDate ? (
                    <Text style={styles.metaText}>
                      {task.scheduledDate
                        ? formatLocalDateForDisplay(task.scheduledDate)
                        : "No planned date"}
                    </Text>
                  ) : null}
                  {task.scheduledTime ? (
                    <Text style={styles.metaText}>
                      {formatLocalTimeForDisplay(task.scheduledTime)}
                    </Text>
                  ) : null}
                  {getTaskPreferredTimeLabel(task) ? (
                    <Text style={styles.metaText}>{getTaskPreferredTimeLabel(task)}</Text>
                  ) : null}
                  {task.estimatedDurationMinutes ? (
                    <Text style={styles.metaText}>
                      {task.estimatedDurationMinutes} min estimate
                    </Text>
                  ) : null}
                  {task.deadlineDate ? (
                    <Text style={styles.metaText}>
                      Deadline {getTaskDeadlineLabel(task)}
                    </Text>
                  ) : null}
                  {task.reminders.length > 0 ? (
                    <Text style={styles.metaText}>
                      Reminders: {formatReminders(task.reminders)}
                    </Text>
                  ) : null}
                  <Text style={styles.metaText}>{getTaskPlanningLabel(task)}</Text>
                  <Text style={styles.metaText}>
                    {getTaskImportanceLabel(task.importance)}
                  </Text>
                  {task.parentTaskId ? (
                    <Text style={styles.metaText}>Smaller task</Text>
                  ) : null}
                  <Text style={styles.metaText}>{getTaskStatusLabel(task.status)}</Text>
                </View>
                {getTaskTimingNote(task) ? (
                  <Text style={styles.timingNote}>{getTaskTimingNote(task)}</Text>
                ) : null}
              </View>
              <View style={styles.actions}>
                <Link
                  href={{ pathname: "/tasks/[id]/edit", params: { id: task.id } }}
                  asChild
                >
                  <Pressable
                    accessibilityLabel={`Edit ${task.title}`}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.editButton,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </Pressable>
                </Link>
                {task.status === "not_started" && onStart ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Start task ${task.title}`}
                    onPress={() => onStart(task.id)}
                    style={({ pressed }) => [
                      styles.executionButton,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text style={styles.executionButtonText}>Start task</Text>
                  </Pressable>
                ) : null}
                {task.status === "started" && onPause ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Pause ${task.title} for now`}
                    onPress={() => onPause(task.id)}
                    style={({ pressed }) => [
                      styles.executionButton,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text style={styles.executionButtonText}>Pause for now</Text>
                  </Pressable>
                ) : null}
                {onSchedule && isTaskActive(task) && task.scheduledTime === null ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Help me schedule ${task.title}`}
                    onPress={() => onSchedule(task.id)}
                    style={({ pressed }) => [
                      styles.scheduleButton,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text style={styles.scheduleButtonText}>Help me schedule</Text>
                  </Pressable>
                ) : null}
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
            </View>
          ))}
        </View>
      )}
    </View>
  );
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
    borderLeftWidth: 5,
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
  timingNote: {
    color: "#53625b",
    fontSize: 13,
    fontWeight: "700"
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
  actions: {
    alignItems: "stretch",
    gap: 8
  },
  actionButtonText: {
    color: "#2f5d62",
    fontSize: 14,
    fontWeight: "700"
  },
  editButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12
  },
  editButtonText: { color: "#24565c", fontSize: 14, fontWeight: "800" },
  executionButton: {
    alignItems: "center",
    backgroundColor: "#e7efeb",
    borderColor: "#789087",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12
  },
  executionButtonText: {
    color: "#244b43",
    fontSize: 14,
    fontWeight: "800"
  },
  scheduleButton: {
    alignItems: "center",
    backgroundColor: "#2f5d62",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12
  },
  scheduleButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  pressed: {
    opacity: 0.65
  }
});

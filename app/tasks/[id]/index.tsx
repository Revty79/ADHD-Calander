import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

import { ErrorNotice } from "../../../src/components/ErrorNotice";
import { Screen } from "../../../src/components/Screen";
import { formatReminderOffsets } from "../../../src/notifications/reminderRules";
import { useTaskDetail } from "../../../src/features/tasks/hooks/useTaskDetail";
import {
  getTaskImportanceLabel,
  getTaskPlanningLabel,
  getTaskPlannedTimePreferenceLabel,
  getTaskStatusLabel,
  getTaskTimingNote
} from "../../../src/features/tasks/taskPresentation";
import { getTaskPlanningState, isTaskActive, Task } from "../../../src/types/task";
import { formatLocalDateForDisplay } from "../../../src/utils/dates";

export default function TaskDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const taskId = typeof params.id === "string" ? params.id : "";
  const detail = useTaskDetail(taskId);
  const refresh = detail.refresh;
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function runAction(action: () => Promise<unknown>) {
    setIsUpdating(true);
    setActionError(null);

    try {
      await action();
      await detail.refresh();
    } catch (error) {
      console.error("Task action failed", error);
      setActionError(
        error instanceof Error ? error.message : "The task could not be updated."
      );
    } finally {
      setIsUpdating(false);
    }
  }

  function confirmRemoval() {
    if (!detail.task) {
      return;
    }

    Alert.alert(
      "Remove from active tasks?",
      "The task will stay in history and can be restored.",
      [
        { text: "Keep task", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => runAction(() => detail.repository.removeTask(detail.task!.id))
        }
      ]
    );
  }

  if (detail.isLoading && !detail.task) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator accessibilityLabel="Loading task" />
          <Text style={styles.muted}>Loading task...</Text>
        </View>
      </Screen>
    );
  }

  if (!detail.task) {
    return (
      <Screen>
        <ErrorNotice
          message={detail.errorMessage ?? "This task could not be found."}
          onRetry={detail.refresh}
        />
      </Screen>
    );
  }

  const task = detail.task;
  const canSchedule = isTaskActive(task) && getTaskPlanningState(task) !== "scheduled";

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.kicker}>{getTaskPlanningLabel(task)} task</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {task.title}
        </Text>
        <Text style={styles.status}>{getTaskStatusLabel(task.status)}</Text>
        {getTaskTimingNote(task) ? (
          <Text style={styles.timingNote}>{getTaskTimingNote(task)}</Text>
        ) : null}
      </View>

      {task.description ? (
        <View style={styles.notesPanel}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notes}>{task.description}</Text>
        </View>
      ) : null}

      <View style={styles.detailsPanel}>
        <Text style={styles.sectionTitle}>Task details</Text>
        <DetailRow label="Importance" value={getTaskImportanceLabel(task.importance)} />
        <DetailRow label="Planning state" value={getTaskPlanningLabel(task)} />
        <DetailRow
          label="Planned date"
          value={
            task.scheduledDate
              ? formatLocalDateForDisplay(task.scheduledDate)
              : "No planned date"
          }
        />
        <DetailRow label="Scheduled time" value={task.scheduledTime ?? "No time"} />
        {getTaskPlanningState(task) === "planned" ? (
          <DetailRow
            label="Preferred time"
            value={getTaskPlannedTimePreferenceLabel(task) ?? "Anytime preference"}
          />
        ) : null}
        <DetailRow
          label="Deadline"
          value={
            task.deadlineDate
              ? formatLocalDateForDisplay(task.deadlineDate)
              : "No deadline"
          }
        />
        <DetailRow
          label="Estimated duration"
          value={
            task.estimatedDurationMinutes
              ? `${task.estimatedDurationMinutes} minutes`
              : "No estimate"
          }
        />
        <DetailRow
          label="Reminders"
          value={formatReminderOffsets(task.reminderOffsets)}
        />
        {task.reminderOffsets.length > 0 ? (
          <DetailRow
            label="Reminder delivery"
            value={
              task.scheduledDate && task.scheduledTime
                ? "Future reminder times are scheduled when reminders are enabled."
                : "Saved and inactive until this task has a date and time."
            }
          />
        ) : null}
        {task.startedAt ? (
          <DetailRow
            label={task.status === "started" ? "Started" : "Last started"}
            value={new Date(task.startedAt).toLocaleString()}
          />
        ) : null}
        {task.completedAt ? (
          <DetailRow
            label="Completed"
            value={new Date(task.completedAt).toLocaleString()}
          />
        ) : null}
      </View>

      {detail.parentTask ? (
        <View style={styles.relationshipPanel}>
          <Text style={styles.sectionTitle}>Part of</Text>
          <Link
            href={{ pathname: "/tasks/[id]", params: { id: detail.parentTask.id } }}
            style={styles.relationshipLink}
          >
            {detail.parentTask.title}
          </Link>
        </View>
      ) : null}

      {detail.childTasks.length > 0 ? (
        <View style={styles.relationshipPanel}>
          <Text style={styles.sectionTitle}>Smaller tasks</Text>
          <View style={styles.childList}>
            {detail.childTasks.map((child) => (
              <ChildTaskRow
                child={child}
                disabled={isUpdating}
                key={child.id}
                onComplete={() =>
                  runAction(() => detail.repository.completeTask(child.id))
                }
                onUndo={() =>
                  runAction(() => detail.repository.undoTaskCompletion(child.id))
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      {detail.errorMessage ? (
        <ErrorNotice message={detail.errorMessage} onRetry={detail.refresh} />
      ) : null}
      {actionError ? (
        <ErrorNotice message={actionError} onRetry={() => setActionError(null)} />
      ) : null}

      <View style={styles.actions}>
        <Link href={{ pathname: "/tasks/[id]/edit", params: { id: task.id } }} asChild>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Edit task</Text>
          </Pressable>
        </Link>

        {canSchedule ? (
          <Link
            href={{ pathname: "/tasks/[id]/schedule", params: { id: task.id } }}
            asChild
          >
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Help me find a time</Text>
            </Pressable>
          </Link>
        ) : null}

        {isTaskActive(task) ? (
          <>
            {task.status === "started" ? (
              <Pressable
                accessibilityLabel={`Pause ${task.title} for now`}
                accessibilityRole="button"
                disabled={isUpdating}
                onPress={() => runAction(() => detail.repository.pauseTask(task.id))}
                style={({ pressed }) => [
                  styles.executionButton,
                  pressed && styles.pressed
                ]}
              >
                <Text style={styles.executionButtonText}>Pause for now</Text>
              </Pressable>
            ) : task.status === "not_started" ? (
              <Pressable
                accessibilityLabel={`Start task ${task.title}`}
                accessibilityRole="button"
                disabled={isUpdating}
                onPress={() => runAction(() => detail.repository.startTask(task.id))}
                style={({ pressed }) => [
                  styles.executionButton,
                  pressed && styles.pressed
                ]}
              >
                <Text style={styles.executionButtonText}>Start task</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={isUpdating}
              onPress={() => runAction(() => detail.repository.completeTask(task.id))}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Complete</Text>
            </Pressable>
            <Link
              href={{ pathname: "/tasks/[id]/breakdown", params: { id: task.id } }}
              asChild
            >
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed
                ]}
              >
                <Text style={styles.secondaryButtonText}>Break into smaller tasks</Text>
              </Pressable>
            </Link>
            <Pressable
              accessibilityRole="button"
              disabled={isUpdating}
              onPress={confirmRemoval}
              style={({ pressed }) => [styles.quietButton, pressed && styles.pressed]}
            >
              <Text style={styles.quietButtonText}>Remove from active tasks</Text>
            </Pressable>
          </>
        ) : null}

        {task.status === "completed" ? (
          <Pressable
            accessibilityRole="button"
            disabled={isUpdating}
            onPress={() => runAction(() => detail.repository.undoTaskCompletion(task.id))}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Undo completion</Text>
          </Pressable>
        ) : null}

        {task.status === "removed" ? (
          <Pressable
            accessibilityRole="button"
            disabled={isUpdating}
            onPress={() => runAction(() => detail.repository.restoreTask(task.id))}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Restore task</Text>
          </Pressable>
        ) : null}

        {task.status === "broken_down" ? (
          <Pressable
            accessibilityRole="button"
            disabled={isUpdating}
            onPress={() => runAction(() => detail.repository.undoTaskBreakdown(task.id))}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Undo breakdown</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function ChildTaskRow({
  child,
  disabled,
  onComplete,
  onUndo
}: {
  child: Task;
  disabled: boolean;
  onComplete(): void;
  onUndo(): void;
}) {
  return (
    <View style={styles.childRow}>
      <View style={styles.childCopy}>
        <Link
          href={{ pathname: "/tasks/[id]", params: { id: child.id } }}
          style={styles.relationshipLink}
        >
          {child.title}
        </Link>
        <Text style={styles.muted}>{getTaskStatusLabel(child.status)}</Text>
      </View>
      {isTaskActive(child) ? (
        <Pressable disabled={disabled} onPress={onComplete} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>Complete</Text>
        </Pressable>
      ) : child.status === "completed" ? (
        <Pressable disabled={disabled} onPress={onUndo} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>Undo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 7, marginBottom: 22 },
  kicker: {
    color: "#59665e",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: { color: "#292724", fontSize: 30, fontWeight: "800" },
  status: { color: "#68645e", fontSize: 15 },
  timingNote: { color: "#53625b", fontSize: 14, fontWeight: "700" },
  loading: { alignItems: "center", gap: 8, paddingVertical: 40 },
  muted: { color: "#68645e", fontSize: 13 },
  notesPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    gap: 9,
    marginBottom: 16,
    padding: 17
  },
  notes: { color: "#48443f", fontSize: 16, lineHeight: 23 },
  detailsPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    gap: 0,
    marginBottom: 16,
    padding: 17
  },
  sectionTitle: { color: "#2f2d2a", fontSize: 18, fontWeight: "800", marginBottom: 8 },
  detailRow: {
    borderBottomColor: "#e4dfd6",
    borderBottomWidth: 1,
    gap: 4,
    paddingVertical: 11
  },
  detailLabel: { color: "#68645e", fontSize: 13, fontWeight: "700" },
  detailValue: { color: "#2f2d2a", fontSize: 16 },
  relationshipPanel: {
    backgroundColor: "#eef2ed",
    borderRadius: 10,
    marginBottom: 16,
    padding: 17
  },
  relationshipLink: {
    color: "#24585d",
    fontSize: 16,
    fontWeight: "800",
    textDecorationLine: "underline"
  },
  childList: { gap: 9 },
  childRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    padding: 12
  },
  childCopy: { flex: 1, gap: 4 },
  actions: { gap: 10, marginTop: 8 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2f5d62",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 50,
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
    minHeight: 48,
    paddingHorizontal: 16
  },
  secondaryButtonText: { color: "#2f5d62", fontSize: 15, fontWeight: "800" },
  executionButton: {
    alignItems: "center",
    backgroundColor: "#e7efeb",
    borderColor: "#789087",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16
  },
  executionButtonText: { color: "#244b43", fontSize: 16, fontWeight: "800" },
  quietButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16
  },
  quietButtonText: { color: "#6a4a42", fontSize: 15, fontWeight: "700" },
  smallButton: {
    borderColor: "#2f5d62",
    borderRadius: 7,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  smallButtonText: { color: "#2f5d62", fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.72 }
});

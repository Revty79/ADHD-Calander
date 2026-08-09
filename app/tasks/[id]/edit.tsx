import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { ErrorNotice } from "../../../src/components/ErrorNotice";
import { TaskEditorForm } from "../../../src/features/tasks/components/TaskEditorForm";
import { useTaskDetail } from "../../../src/features/tasks/hooks/useTaskDetail";
import { UpdateTaskInput } from "../../../src/types/task";

export default function EditTaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const taskId = typeof params.id === "string" ? params.id : "";
  const detail = useTaskDetail(taskId);
  const refresh = detail.refresh;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function saveTask(input: UpdateTaskInput) {
    await detail.repository.updateTask(taskId, input);
    router.replace({ pathname: "/tasks/[id]", params: { id: taskId } });
  }

  if (detail.isLoading && !detail.task) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator accessibilityLabel="Loading task editor" />
        <Text style={styles.muted}>Loading task...</Text>
      </View>
    );
  }

  if (!detail.task) {
    return (
      <View style={styles.errorPage}>
        <ErrorNotice
          message={detail.errorMessage ?? "This task could not be found."}
          onRetry={detail.refresh}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={styles.keyboardView}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TaskEditorForm
          initialTask={detail.task}
          key={detail.task.updatedAt}
          onSubmit={saveTask}
          submitLabel="Save changes"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: { backgroundColor: "#f8f7f3", flex: 1 },
  content: { padding: 20, paddingBottom: 36 },
  loading: {
    alignItems: "center",
    backgroundColor: "#f8f7f3",
    flex: 1,
    gap: 8,
    justifyContent: "center"
  },
  muted: { color: "#68645e", fontSize: 15 },
  errorPage: { backgroundColor: "#f8f7f3", flex: 1, padding: 20 }
});

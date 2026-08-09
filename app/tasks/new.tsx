import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";

import { useTaskRepository } from "../../src/database/DatabaseProvider";
import { TaskEditorForm } from "../../src/features/tasks/components/TaskEditorForm";
import { CreateTaskInput } from "../../src/types/task";
import { normalizeLocalDateInput } from "../../src/utils/dates";

type NewTaskParams = {
  scheduledDate?: string;
  returnTo?: string;
};

export default function NewTaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<NewTaskParams>();
  const taskRepository = useTaskRepository();
  const initialDate = useMemo(
    () => normalizeLocalDateInput(params.scheduledDate ?? "") ?? "",
    [params.scheduledDate]
  );

  async function saveTask(input: CreateTaskInput) {
    const task = await taskRepository.createTask(input);

    if (params.returnTo === "calendar") {
      router.replace({
        pathname: "/(tabs)/calendar",
        params: { date: task.scheduledDate ?? initialDate }
      });
    } else if (params.returnTo === "tasks") {
      router.replace("/(tabs)/tasks");
    } else {
      router.replace("/(tabs)");
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={styles.keyboardView}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        style={styles.scrollView}
      >
        <TaskEditorForm
          initialDate={initialDate}
          onSubmit={saveTask}
          submitLabel="Save task"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: { backgroundColor: "#f8f7f3", flex: 1 },
  scrollView: { backgroundColor: "#f8f7f3" },
  content: { padding: 20, paddingBottom: 36 }
});

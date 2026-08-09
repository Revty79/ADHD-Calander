import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { ErrorNotice } from "../../../src/components/ErrorNotice";
import { Screen } from "../../../src/components/Screen";
import { TaskValidationError } from "../../../src/database/repositories/errors";
import { useTaskDetail } from "../../../src/features/tasks/hooks/useTaskDetail";

export default function BreakDownTaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const taskId = typeof params.id === "string" ? params.id : "";
  const detail = useTaskDetail(taskId);
  const refresh = detail.refresh;
  const [titles, setTitles] = useState(["", ""]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function saveBreakdown() {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await detail.repository.breakDownTask(taskId, { titles });
      router.replace({ pathname: "/tasks/[id]", params: { id: taskId } });
    } catch (error) {
      setErrorMessage(
        error instanceof TaskValidationError
          ? error.message
          : "The smaller tasks could not be saved. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (detail.isLoading && !detail.task) {
    return (
      <Screen>
        <ActivityIndicator accessibilityLabel="Loading task" />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.kicker}>Smaller steps</Text>
        <Text style={styles.title}>Break down {detail.task?.title ?? "this task"}</Text>
        <Text style={styles.intro}>
          Add at least two clear steps. The original stays as a visible container, and
          each smaller task can be planned and completed on its own.
        </Text>
      </View>

      <View style={styles.fields}>
        {titles.map((title, index) => (
          <View key={index} style={styles.field}>
            <Text style={styles.label}>Smaller task {index + 1}</Text>
            <View style={styles.inputRow}>
              <TextInput
                accessibilityLabel={`Smaller task ${index + 1} title`}
                onChangeText={(value) =>
                  setTitles((current) =>
                    current.map((item, itemIndex) => (itemIndex === index ? value : item))
                  )
                }
                placeholder="A clear next step"
                style={styles.input}
                value={title}
              />
              {titles.length > 2 ? (
                <Pressable
                  accessibilityLabel={`Remove smaller task ${index + 1}`}
                  accessibilityRole="button"
                  onPress={() =>
                    setTitles((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {titles.length < 20 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setTitles((current) => [...current, ""])}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Add another smaller task</Text>
        </Pressable>
      ) : null}

      {errorMessage ? (
        <ErrorNotice message={errorMessage} onRetry={() => setErrorMessage(null)} />
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={saveBreakdown}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>
          {isSaving ? "Saving smaller tasks..." : "Create smaller tasks"}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8, marginBottom: 24 },
  kicker: {
    color: "#59665e",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: { color: "#292724", fontSize: 27, fontWeight: "800" },
  intro: { color: "#5a5650", fontSize: 15, lineHeight: 22 },
  fields: { gap: 16, marginBottom: 16 },
  field: { gap: 7 },
  label: { color: "#2f2d2a", fontSize: 15, fontWeight: "700" },
  inputRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#cfc8bd",
    borderRadius: 8,
    borderWidth: 1,
    color: "#2f2d2a",
    flex: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 13
  },
  removeButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  removeButtonText: { color: "#6a4a42", fontSize: 13, fontWeight: "700" },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#2f5d62",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    marginBottom: 16,
    paddingHorizontal: 14
  },
  secondaryButtonText: { color: "#2f5d62", fontSize: 15, fontWeight: "800" },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2f5d62",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 50,
    marginTop: 10,
    paddingHorizontal: 16
  },
  primaryButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "800" }
});

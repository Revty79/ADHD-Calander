import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { ErrorNotice } from "../../src/components/ErrorNotice";
import { useTaskRepository } from "../../src/database/DatabaseProvider";
import { TaskValidationError } from "../../src/database/repositories/errors";
import { ReminderOffsetSelector } from "../../src/features/reminders/components/ReminderOffsetSelector";
import { useReminderSettings } from "../../src/features/settings/hooks/useReminderSettings";
import { ReminderOffsetMinutes } from "../../src/types/reminder";
import { normalizeLocalDateInput } from "../../src/utils/dates";

type NewTaskParams = {
  scheduledDate?: string;
  returnTo?: string;
};

type FieldErrors = Partial<Record<TaskValidationError["field"], string>>;

export default function NewTaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<NewTaskParams>();
  const taskRepository = useTaskRepository();
  const reminderSettings = useReminderSettings();
  const initialDate = useMemo(
    () => normalizeLocalDateInput(params.scheduledDate ?? "") ?? "",
    [params.scheduledDate]
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState<string>(initialDate);
  const [scheduledTime, setScheduledTime] = useState("");
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [reminderOffsetMinutes, setReminderOffsetMinutes] =
    useState<ReminderOffsetMinutes | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveTask() {
    setFieldErrors({});
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await taskRepository.createTask({
        title,
        description,
        scheduledDate,
        scheduledTime,
        estimatedDurationMinutes: estimatedDurationMinutes.trim()
          ? Number(estimatedDurationMinutes)
          : null,
        deadlineDate,
        reminderOffsetMinutes
      });

      if (params.returnTo === "calendar") {
        router.replace({
          pathname: "/(tabs)/calendar",
          params: { date: scheduledDate }
        });
        return;
      }

      if (params.returnTo === "tasks") {
        router.replace("/(tabs)/tasks");
        return;
      }

      router.replace("/(tabs)");
    } catch (error) {
      if (error instanceof TaskValidationError) {
        setFieldErrors({ [error.field]: error.message });
      } else {
        setErrorMessage("The task could not be saved. Please try again.");
      }
    } finally {
      setIsSaving(false);
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
        <View style={styles.formGroup}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            accessibilityLabel="Task title"
            autoCapitalize="sentences"
            onChangeText={setTitle}
            placeholder="Task title"
            returnKeyType="next"
            style={[styles.input, fieldErrors.title ? styles.inputError : null]}
            value={title}
          />
          {fieldErrors.title ? (
            <Text accessibilityRole="alert" style={styles.validationText}>
              {fieldErrors.title}
            </Text>
          ) : null}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            accessibilityLabel="Task description"
            multiline
            onChangeText={setDescription}
            placeholder="Optional details"
            style={[styles.input, styles.multilineInput]}
            textAlignVertical="top"
            value={description}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Scheduled date (optional)</Text>
          <TextInput
            accessibilityLabel="Scheduled date in year month day format"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            onChangeText={setScheduledDate}
            placeholder="YYYY-MM-DD"
            style={[styles.input, fieldErrors.scheduledDate ? styles.inputError : null]}
            value={scheduledDate}
          />
          {fieldErrors.scheduledDate ? (
            <Text accessibilityRole="alert" style={styles.validationText}>
              {fieldErrors.scheduledDate}
            </Text>
          ) : null}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Estimated duration (optional)</Text>
          <TextInput
            accessibilityLabel="Optional estimated task duration in minutes"
            keyboardType="number-pad"
            onChangeText={setEstimatedDurationMinutes}
            placeholder="Minutes, for example 30"
            style={[
              styles.input,
              fieldErrors.estimatedDurationMinutes ? styles.inputError : null
            ]}
            value={estimatedDurationMinutes}
          />
          {fieldErrors.estimatedDurationMinutes ? (
            <Text accessibilityRole="alert" style={styles.validationText}>
              {fieldErrors.estimatedDurationMinutes}
            </Text>
          ) : null}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Deadline (optional)</Text>
          <TextInput
            accessibilityLabel="Deadline in year month day format"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            onChangeText={setDeadlineDate}
            placeholder="YYYY-MM-DD"
            style={[styles.input, fieldErrors.deadlineDate ? styles.inputError : null]}
            value={deadlineDate}
          />
          <Text style={styles.helpText}>
            A deadline is the last day to finish, not the time you plan to work.
          </Text>
          {fieldErrors.deadlineDate ? (
            <Text accessibilityRole="alert" style={styles.validationText}>
              {fieldErrors.deadlineDate}
            </Text>
          ) : null}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Scheduled time</Text>
          <TextInput
            accessibilityLabel="Scheduled time in twenty four hour format"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            onChangeText={setScheduledTime}
            placeholder="Optional, HH:MM"
            style={[styles.input, fieldErrors.scheduledTime ? styles.inputError : null]}
            value={scheduledTime}
          />
          {fieldErrors.scheduledTime ? (
            <Text accessibilityRole="alert" style={styles.validationText}>
              {fieldErrors.scheduledTime}
            </Text>
          ) : null}
        </View>

        <ReminderOffsetSelector
          disabled={
            reminderSettings.isLoading ||
            reminderSettings.status?.settings.remindersEnabled !== true
          }
          error={fieldErrors.reminderOffsetMinutes}
          onChange={setReminderOffsetMinutes}
          value={reminderOffsetMinutes}
        />

        {errorMessage ? (
          <ErrorNotice message={errorMessage} onRetry={() => setErrorMessage(null)} />
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save task"
          disabled={isSaving}
          onPress={saveTask}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.pressed,
            isSaving && styles.disabledButton
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color="#ffffff" accessibilityLabel="Saving task" />
          ) : (
            <Text style={styles.saveButtonText}>Save task</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    backgroundColor: "#f8f7f3",
    flex: 1
  },
  scrollView: {
    backgroundColor: "#f8f7f3"
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 36
  },
  formGroup: {
    gap: 8
  },
  label: {
    color: "#2f2d2a",
    fontSize: 16,
    fontWeight: "700"
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#cfc8bd",
    borderRadius: 8,
    borderWidth: 1,
    color: "#2f2d2a",
    fontSize: 17,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  inputError: {
    borderColor: "#a53f3f"
  },
  helpText: {
    color: "#68645e",
    fontSize: 13,
    lineHeight: 19
  },
  multilineInput: {
    minHeight: 96
  },
  validationText: {
    color: "#8d3434",
    fontSize: 14
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#2f5d62",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700"
  },
  disabledButton: {
    opacity: 0.65
  },
  pressed: {
    opacity: 0.75
  }
});

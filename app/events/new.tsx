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
import { useCalendarEventRepository } from "../../src/database/DatabaseProvider";
import { CalendarEventValidationError } from "../../src/database/repositories/calendarEventErrors";
import { ReminderOffsetSelector } from "../../src/features/reminders/components/ReminderOffsetSelector";
import { useReminderSettings } from "../../src/features/settings/hooks/useReminderSettings";
import { ReminderOffsetMinutes } from "../../src/types/reminder";
import { getLocalDateString, normalizeLocalDateInput } from "../../src/utils/dates";

type FieldErrors = Partial<Record<CalendarEventValidationError["field"], string>>;

export default function NewEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const eventRepository = useCalendarEventRepository();
  const reminderSettings = useReminderSettings();
  const initialDate = useMemo(
    () => normalizeLocalDateInput(params.date ?? "") ?? getLocalDateString(),
    [params.date]
  );
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>(initialDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [reminderOffsets, setReminderOffsets] = useState<ReminderOffsetMinutes[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveEvent() {
    setFieldErrors({});
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await eventRepository.createEvent({
        title,
        date,
        startTime,
        endTime,
        durationMinutes: durationMinutes.trim() ? Number(durationMinutes) : null,
        notes,
        reminderOffsets
      });

      router.replace({ pathname: "/(tabs)/calendar", params: { date } });
    } catch (error) {
      if (error instanceof CalendarEventValidationError) {
        setFieldErrors({ [error.field]: error.message });
      } else {
        setErrorMessage("The event could not be saved. Please try again.");
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
        <Text style={styles.helperText}>
          Events are fixed commitments. Flexible work stays a task.
        </Text>

        <FormField label="Title" error={fieldErrors.title}>
          <TextInput
            accessibilityLabel="Event title"
            autoCapitalize="sentences"
            onChangeText={setTitle}
            placeholder="Event title"
            style={[styles.input, fieldErrors.title && styles.inputError]}
            value={title}
          />
        </FormField>

        <FormField label="Date" error={fieldErrors.date}>
          <TextInput
            accessibilityLabel="Event date in year month day format"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            style={[styles.input, fieldErrors.date && styles.inputError]}
            value={date}
          />
        </FormField>

        <FormField label="Start time" error={fieldErrors.startTime}>
          <TextInput
            accessibilityLabel="Event start time in twenty four hour format"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            onChangeText={setStartTime}
            placeholder="HH:MM"
            style={[styles.input, fieldErrors.startTime && styles.inputError]}
            value={startTime}
          />
        </FormField>

        <FormField label="End time (optional)" error={fieldErrors.endTime}>
          <TextInput
            accessibilityLabel="Optional event end time in twenty four hour format"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            onChangeText={setEndTime}
            placeholder="HH:MM"
            style={[styles.input, fieldErrors.endTime && styles.inputError]}
            value={endTime}
          />
        </FormField>

        <Text style={styles.orText}>Use an end time or a duration, not both.</Text>

        <FormField
          label="Duration in minutes (optional)"
          error={fieldErrors.durationMinutes}
        >
          <TextInput
            accessibilityLabel="Optional event duration in minutes"
            keyboardType="number-pad"
            onChangeText={setDurationMinutes}
            placeholder="For example, 45"
            style={[styles.input, fieldErrors.durationMinutes && styles.inputError]}
            value={durationMinutes}
          />
        </FormField>

        <FormField label="Notes (optional)">
          <TextInput
            accessibilityLabel="Optional event notes"
            multiline
            onChangeText={setNotes}
            placeholder="Helpful details"
            style={[styles.input, styles.multilineInput]}
            textAlignVertical="top"
            value={notes}
          />
        </FormField>

        <ReminderOffsetSelector
          disabled={
            reminderSettings.isLoading ||
            reminderSettings.status?.settings.remindersEnabled !== true
          }
          error={fieldErrors.reminderOffsets}
          onChange={setReminderOffsets}
          value={reminderOffsets}
        />

        {errorMessage ? (
          <ErrorNotice message={errorMessage} onRetry={() => setErrorMessage(null)} />
        ) : null}

        <Pressable
          accessibilityLabel="Save fixed event"
          accessibilityRole="button"
          disabled={isSaving}
          onPress={saveEvent}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.pressed,
            isSaving && styles.disabledButton
          ]}
        >
          {isSaving ? (
            <ActivityIndicator accessibilityLabel="Saving event" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save event</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormField({
  children,
  error,
  label
}: {
  children: React.ReactNode;
  error?: string | undefined;
  label: string;
}) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? (
        <Text accessibilityRole="alert" style={styles.validationText}>
          {error}
        </Text>
      ) : null}
    </View>
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
  helperText: {
    color: "#4f5c54",
    fontSize: 15,
    lineHeight: 22
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
  multilineInput: {
    minHeight: 96
  },
  validationText: {
    color: "#8d3434",
    fontSize: 14
  },
  orText: {
    color: "#68645e",
    fontSize: 13,
    marginTop: -8
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

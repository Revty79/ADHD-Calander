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
import {
  NativeDatePickerButton,
  NativeTimePickerButton
} from "../../src/components/NativeDateTimePickerButton";
import { useCalendarEventRepository } from "../../src/database/DatabaseProvider";
import { CalendarEventValidationError } from "../../src/database/repositories/calendarEventErrors";
import { ReminderEditor } from "../../src/features/reminders/components/ReminderEditor";
import { getReminderDeliveryMessage } from "../../src/features/reminders/reminderEditorModel";
import { useReminderSettings } from "../../src/features/settings/hooks/useReminderSettings";
import { Reminder } from "../../src/types/reminder";
import { getLocalDateString, normalizeLocalDateInput } from "../../src/utils/dates";

type FieldErrors = Partial<Record<CalendarEventValidationError["field"], string>>;

const eventDurationOptions: (number | null)[] = [null, 15, 30, 45, 60, 90, 120];

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
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [reminders, setReminders] = useState<Reminder[]>([]);
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
        durationMinutes,
        notes,
        reminders
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
          <NativeDatePickerButton
            accessibilityLabel="Choose event date"
            onChange={setDate}
            value={date}
          />
        </FormField>

        <FormField label="Start time" error={fieldErrors.startTime}>
          <NativeTimePickerButton
            accessibilityLabel="Choose event start time"
            onChange={(value) => setStartTime(value)}
            value={startTime}
          />
        </FormField>

        <FormField label="End time (optional)" error={fieldErrors.endTime}>
          <NativeTimePickerButton
            accessibilityLabel="Choose optional event end time"
            onChange={(value) => {
              setEndTime(value);
              setDurationMinutes(null);
            }}
            value={endTime}
          />
          {endTime ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setEndTime("")}
              style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
            >
              <Text style={styles.clearButtonText}>Clear end time</Text>
            </Pressable>
          ) : null}
        </FormField>

        <Text style={styles.orText}>Use an end time or a duration, not both.</Text>

        <FormField label="Duration (optional)" error={fieldErrors.durationMinutes}>
          <View accessibilityRole="radiogroup" style={styles.choiceWrap}>
            {eventDurationOptions.map((duration) => {
              const selected = duration === durationMinutes;

              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={duration ?? "none"}
                  onPress={() => {
                    setDurationMinutes(duration);

                    if (duration !== null) {
                      setEndTime("");
                    }
                  }}
                  style={({ pressed }) => [
                    styles.choice,
                    selected && styles.choiceSelected,
                    pressed && styles.pressed
                  ]}
                >
                  <Text
                    style={[styles.choiceText, selected && styles.choiceTextSelected]}
                  >
                    {duration === null ? "No duration" : `${duration} min`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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

        <ReminderEditor
          allowRelative
          deliveryMessage={
            reminderSettings.isLoading
              ? "Checking reminder delivery settings..."
              : getReminderDeliveryMessage(
                  reminderSettings.status?.permissionStatus,
                  reminderSettings.status?.settings.remindersEnabled
                )
          }
          error={fieldErrors.reminders ?? fieldErrors.reminderOffsets}
          onChange={setReminders}
          value={reminders}
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
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#aaa49a",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 13
  },
  choiceSelected: { backgroundColor: "#edf4f2", borderColor: "#2f5d62" },
  choiceText: { color: "#4a4742", fontSize: 14, fontWeight: "600" },
  choiceTextSelected: { color: "#244b4f", fontWeight: "800" },
  clearButton: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 4
  },
  clearButtonText: { color: "#24565c", fontSize: 14, fontWeight: "700" },
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

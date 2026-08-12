import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { ErrorNotice } from "../../../components/ErrorNotice";
import { ItemColorPicker } from "../../../components/ItemColorPicker";
import {
  NativeDatePickerButton,
  NativeTimePickerButton
} from "../../../components/NativeDateTimePickerButton";
import { CalendarEventValidationError } from "../../../database/repositories/calendarEventErrors";
import {
  CalendarEventOccurrence,
  CalendarRecurrenceRule,
  CreateCalendarEventInput
} from "../../../types/calendarEvent";
import { ItemColor } from "../../../types/itemColor";
import { Reminder } from "../../../types/reminder";
import { ReminderEditor } from "../../reminders/components/ReminderEditor";
import { getReminderDeliveryMessage } from "../../reminders/reminderEditorModel";
import { useReminderSettings } from "../../settings/hooks/useReminderSettings";
import { RecurrenceEditor } from "./RecurrenceEditor";

type FieldErrors = Partial<Record<CalendarEventValidationError["field"], string>>;

const eventDurationOptions: (number | null)[] = [null, 15, 30, 45, 60, 90, 120];

export function EventEditorForm({
  allowRecurrenceEdit = true,
  initialDate,
  initialEvent,
  initialRecurrence = null,
  onDelete,
  onSubmit,
  submitLabel
}: {
  allowRecurrenceEdit?: boolean;
  initialDate: string;
  initialEvent?: CalendarEventOccurrence;
  initialRecurrence?: CalendarRecurrenceRule | null;
  onDelete?(): Promise<void>;
  onSubmit(input: CreateCalendarEventInput): Promise<void>;
  submitLabel: string;
}) {
  const reminderSettings = useReminderSettings();
  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [date, setDate] = useState(initialEvent?.date ?? initialDate);
  const [startTime, setStartTime] = useState(initialEvent?.startTime ?? "");
  const [endTime, setEndTime] = useState(initialEvent?.endTime ?? "");
  const [durationMinutes, setDurationMinutes] = useState<number | null>(
    initialEvent?.durationMinutes ?? null
  );
  const [recurrence, setRecurrence] = useState<CalendarRecurrenceRule | null>(
    initialRecurrence
  );
  const [color, setColor] = useState<ItemColor>(initialEvent?.color ?? "neutral");
  const [reminders, setReminders] = useState<Reminder[]>(initialEvent?.reminders ?? []);
  const [notes, setNotes] = useState(initialEvent?.notes ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function saveEvent() {
    setFieldErrors({});
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await onSubmit({
        title,
        date,
        startTime,
        endTime,
        durationMinutes,
        recurrence,
        color,
        reminders,
        notes
      });
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

  async function deleteEvent() {
    if (!onDelete) return;
    setErrorMessage(null);
    setIsDeleting(true);
    try {
      await onDelete();
    } catch {
      setErrorMessage("The event could not be removed. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.helperText}>
        Events are fixed commitments. Flexible work stays a task.
      </Text>
      <Field error={fieldErrors.title} label="Title">
        <TextInput
          accessibilityLabel="Event title"
          autoCapitalize="sentences"
          onChangeText={setTitle}
          placeholder="Event title"
          style={[styles.input, fieldErrors.title && styles.inputError]}
          value={title}
        />
      </Field>
      <Field error={fieldErrors.date} label="Date">
        <NativeDatePickerButton
          accessibilityLabel="Choose event date"
          onChange={setDate}
          value={date}
        />
      </Field>
      <Field error={fieldErrors.startTime} label="Start time">
        <NativeTimePickerButton
          accessibilityLabel="Choose event start time"
          onChange={setStartTime}
          value={startTime}
        />
      </Field>
      <Field error={fieldErrors.endTime} label="End time (optional)">
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
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          >
            <Text style={styles.textButtonText}>Clear end time</Text>
          </Pressable>
        ) : null}
      </Field>
      <Text style={styles.hint}>Use an end time or a duration, not both.</Text>
      <Field error={fieldErrors.durationMinutes} label="Duration (optional)">
        <View accessibilityRole="radiogroup" style={styles.choices}>
          {eventDurationOptions.map((duration) => (
            <Choice
              key={duration ?? "none"}
              label={duration === null ? "No duration" : `${duration} min`}
              onPress={() => {
                setDurationMinutes(duration);
                if (duration !== null) setEndTime("");
              }}
              selected={duration === durationMinutes}
            />
          ))}
        </View>
      </Field>
      <RecurrenceEditor
        date={date as CalendarEventOccurrence["date"]}
        disabled={!allowRecurrenceEdit}
        error={fieldErrors.recurrence}
        onChange={setRecurrence}
        value={recurrence}
      />
      <ItemColorPicker onChange={setColor} value={color} />
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
      <Field label="Notes (optional)">
        <TextInput
          accessibilityLabel="Optional event notes"
          multiline
          onChangeText={setNotes}
          placeholder="Helpful details"
          style={[styles.input, styles.multilineInput]}
          textAlignVertical="top"
          value={notes}
        />
      </Field>
      {errorMessage ? (
        <ErrorNotice message={errorMessage} onRetry={() => setErrorMessage(null)} />
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={isSaving || isDeleting}
        onPress={saveEvent}
        style={({ pressed }) => [
          styles.saveButton,
          pressed && styles.pressed,
          (isSaving || isDeleting) && styles.disabled
        ]}
      >
        {isSaving ? (
          <ActivityIndicator accessibilityLabel="Saving event" color="#fff" />
        ) : (
          <Text style={styles.saveText}>{submitLabel}</Text>
        )}
      </Pressable>
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          disabled={isSaving || isDeleting}
          onPress={deleteEvent}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        >
          <Text style={styles.deleteText}>
            {isDeleting ? "Removing event..." : "Remove event"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Field({
  children,
  error,
  label
}: {
  children: React.ReactNode;
  error?: string | undefined;
  label: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function Choice({
  label,
  onPress,
  selected
}: {
  label: string;
  onPress(): void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.pressed
      ]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: 18 },
  helperText: { color: "#4f5c54", fontSize: 15, lineHeight: 22 },
  field: { gap: 8 },
  label: { color: "#2f2d2a", fontSize: 16, fontWeight: "700" },
  input: {
    backgroundColor: "#fff",
    borderColor: "#cfc8bd",
    borderRadius: 8,
    borderWidth: 1,
    color: "#2f2d2a",
    fontSize: 17,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  inputError: { borderColor: "#a53f3f" },
  multilineInput: { minHeight: 96 },
  hint: { color: "#68645e", fontSize: 13, marginTop: -8 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    alignItems: "center",
    backgroundColor: "#fff",
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
  textButton: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 4
  },
  textButtonText: { color: "#24565c", fontSize: 14, fontWeight: "700" },
  errorText: { color: "#8d3434", fontSize: 14 },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#2f5d62",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18
  },
  saveText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  deleteButton: {
    alignItems: "center",
    borderColor: "#95645e",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16
  },
  deleteText: { color: "#713f3b", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.72 }
});

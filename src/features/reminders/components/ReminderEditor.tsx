import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  NativeDatePickerButton,
  NativeTimePickerButton
} from "../../../components/NativeDateTimePickerButton";
import {
  formatReminder,
  formatReminderOffset
} from "../../../notifications/reminderRules";
import { getReminderKey } from "../../../notifications/reminders";
import {
  maxRemindersPerItem,
  Reminder,
  reminderSelectionOptions
} from "../../../types/reminder";
import { getLocalDateString } from "../../../utils/dates";
import {
  removeReminder,
  toggleRelativeReminder,
  upsertAbsoluteReminder
} from "../reminderEditorModel";

type Props = {
  allowRelative: boolean;
  deliveryMessage: string;
  error?: string | undefined;
  onChange(value: Reminder[]): void;
  value: Reminder[];
};

export function ReminderEditor({
  allowRelative,
  deliveryMessage,
  error,
  onChange,
  value
}: Props) {
  const [customDate, setCustomDate] = useState(() => getLocalDateString());
  const [customTime, setCustomTime] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function saveCustomReminder() {
    setLocalError(null);

    try {
      onChange(upsertAbsoluteReminder(value, editingKey, customDate, customTime));
      resetCustomEditor();
    } catch (saveError) {
      setLocalError(
        saveError instanceof Error
          ? saveError.message
          : "Choose a valid reminder date and time."
      );
    }
  }

  function editReminder(reminder: Reminder) {
    if (reminder.kind !== "absolute") {
      return;
    }

    setEditingKey(getReminderKey(reminder));
    setCustomDate(reminder.date);
    setCustomTime(reminder.time);
    setLocalError(null);
  }

  function removeSavedReminder(reminder: Reminder) {
    onChange(removeReminder(value, reminder));

    if (editingKey === getReminderKey(reminder)) {
      resetCustomEditor();
    }
  }

  function resetCustomEditor() {
    setEditingKey(null);
    setCustomDate(getLocalDateString());
    setCustomTime("");
    setLocalError(null);
  }

  const atLimit = value.length >= maxRemindersPerItem && editingKey === null;

  return (
    <View style={styles.group}>
      <Text style={styles.label}>Reminders</Text>
      <Text style={styles.helper}>
        Add up to {maxRemindersPerItem}. A reminder prompts you without changing the task
        or event placement.
      </Text>
      <Text style={styles.delivery}>{deliveryMessage}</Text>

      {allowRelative ? (
        <View style={styles.subgroup}>
          <Text style={styles.subheading}>Relative to the scheduled time</Text>
          <View style={styles.options}>
            {reminderSelectionOptions.map((offsetMinutes) => {
              const reminder: Reminder = { kind: "relative", offsetMinutes };
              const checked = value.some(
                (candidate) => getReminderKey(candidate) === getReminderKey(reminder)
              );
              const disabled = value.length >= maxRemindersPerItem && !checked;
              const label = formatReminderOffset(offsetMinutes);

              return (
                <Pressable
                  accessibilityLabel={label}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked, disabled }}
                  disabled={disabled}
                  key={offsetMinutes}
                  onPress={() => onChange(toggleRelativeReminder(value, offsetMinutes))}
                  style={({ pressed }) => [
                    styles.option,
                    checked && styles.optionSelected,
                    disabled && styles.disabled,
                    pressed && styles.pressed
                  ]}
                >
                  <Text style={[styles.optionText, checked && styles.optionTextSelected]}>
                    {checked ? "Selected: " : ""}
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {value.length > 0 ? (
        <View style={styles.subgroup}>
          <Text style={styles.subheading}>Saved reminders</Text>
          {value.map((reminder) => (
            <View key={getReminderKey(reminder)} style={styles.savedRow}>
              <View style={styles.savedCopy}>
                <Text style={styles.savedLabel}>{formatReminder(reminder)}</Text>
                {!allowRelative && reminder.kind === "relative" ? (
                  <Text style={styles.savedHint}>
                    Saved; active again if this task becomes Scheduled.
                  </Text>
                ) : null}
              </View>
              {reminder.kind === "absolute" ? (
                <Pressable
                  accessibilityLabel={`Edit reminder ${formatReminder(reminder)}`}
                  accessibilityRole="button"
                  onPress={() => editReminder(reminder)}
                  style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
                >
                  <Text style={styles.textButtonText}>Edit</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityLabel={`Remove reminder ${formatReminder(reminder)}`}
                accessibilityRole="button"
                onPress={() => removeSavedReminder(reminder)}
                style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.subgroup}>
        <Text style={styles.subheading}>
          {editingKey ? "Edit custom reminder" : "Custom date and time"}
        </Text>
        <NativeDatePickerButton
          accessibilityLabel="Choose custom reminder date"
          onChange={setCustomDate}
          value={customDate}
        />
        <NativeTimePickerButton
          accessibilityLabel="Choose custom reminder time"
          onChange={setCustomTime}
          value={customTime}
        />
        <View style={styles.customActions}>
          <Pressable
            accessibilityRole="button"
            disabled={atLimit}
            onPress={saveCustomReminder}
            style={({ pressed }) => [
              styles.addButton,
              atLimit && styles.disabled,
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.addButtonText}>
              {editingKey ? "Save reminder" : "Add reminder"}
            </Text>
          </Pressable>
          {editingKey ? (
            <Pressable
              accessibilityRole="button"
              onPress={resetCustomEditor}
              style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
            >
              <Text style={styles.textButtonText}>Cancel edit</Text>
            </Pressable>
          ) : null}
        </View>
        {atLimit ? (
          <Text style={styles.savedHint}>Remove a reminder before adding another.</Text>
        ) : null}
      </View>

      {localError || error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {localError ?? error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  label: { color: "#2f2d2a", fontSize: 16, fontWeight: "700" },
  helper: { color: "#68645e", fontSize: 14, lineHeight: 20 },
  delivery: { color: "#405e55", fontSize: 13, fontWeight: "700", lineHeight: 19 },
  subgroup: { gap: 8 },
  subheading: { color: "#4a4742", fontSize: 14, fontWeight: "700" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    backgroundColor: "#ffffff",
    borderColor: "#cfc8bd",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12
  },
  optionSelected: { backgroundColor: "#edf4f2", borderColor: "#2f5d62" },
  optionText: { color: "#4a4742", fontSize: 14, fontWeight: "600" },
  optionTextSelected: { color: "#244b4f", fontWeight: "800" },
  savedRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#ded9cf",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  savedCopy: { flex: 1, gap: 2 },
  savedLabel: { color: "#2f2d2a", fontSize: 14, fontWeight: "700" },
  savedHint: { color: "#68645e", fontSize: 12, lineHeight: 17 },
  customActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  addButton: {
    alignItems: "center",
    backgroundColor: "#e7efeb",
    borderColor: "#789087",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14
  },
  addButtonText: { color: "#244b43", fontSize: 14, fontWeight: "800" },
  textButton: { justifyContent: "center", minHeight: 44, paddingHorizontal: 4 },
  textButtonText: { color: "#24565c", fontSize: 13, fontWeight: "800" },
  removeText: { color: "#79504a", fontSize: 13, fontWeight: "800" },
  error: { color: "#8d3434", fontSize: 14 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 }
});

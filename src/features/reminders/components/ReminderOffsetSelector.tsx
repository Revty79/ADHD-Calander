import { Pressable, StyleSheet, Text, View } from "react-native";

import { ReminderOffsetMinutes, reminderOffsetOptions } from "../../../types/reminder";
import { formatReminderOffset } from "../../../notifications/reminderRules";

type Props = {
  disabled: boolean;
  error?: string | undefined;
  onChange(value: ReminderOffsetMinutes | null): void;
  value: ReminderOffsetMinutes | null;
};

const options: (ReminderOffsetMinutes | null)[] = [null, ...reminderOffsetOptions];

export function ReminderOffsetSelector({ disabled, error, onChange, value }: Props) {
  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      <Text style={styles.label}>Reminder</Text>
      <Text style={styles.helper}>
        {disabled
          ? "Turn on reminders in Settings to choose one here."
          : "Optional. Choose at most one gentle reminder."}
      </Text>
      <View style={styles.options}>
        {options.map((option) => {
          const checked = option === value;
          const label = formatReminderOffset(option);

          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="radio"
              accessibilityState={{ checked, disabled }}
              disabled={disabled}
              key={option ?? "none"}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.option,
                checked && styles.optionSelected,
                disabled && styles.optionDisabled,
                pressed && styles.pressed
              ]}
            >
              <View style={[styles.radio, checked && styles.radioSelected]} />
              <Text style={[styles.optionText, checked && styles.optionTextSelected]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8
  },
  label: {
    color: "#2f2d2a",
    fontSize: 16,
    fontWeight: "700"
  },
  helper: {
    color: "#68645e",
    fontSize: 14,
    lineHeight: 20
  },
  options: {
    gap: 8
  },
  option: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#cfc8bd",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14
  },
  optionSelected: {
    backgroundColor: "#edf4f2",
    borderColor: "#2f5d62"
  },
  optionDisabled: {
    opacity: 0.55
  },
  radio: {
    borderColor: "#77716a",
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    width: 20
  },
  radioSelected: {
    backgroundColor: "#2f5d62",
    borderColor: "#2f5d62",
    borderWidth: 5
  },
  optionText: {
    color: "#4a4742",
    fontSize: 16
  },
  optionTextSelected: {
    color: "#244b4f",
    fontWeight: "700"
  },
  error: {
    color: "#8d3434",
    fontSize: 14
  },
  pressed: {
    opacity: 0.75
  }
});

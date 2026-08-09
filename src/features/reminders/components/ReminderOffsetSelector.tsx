import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  maxRemindersPerItem,
  ReminderOffsetMinutes,
  reminderSelectionOptions
} from "../../../types/reminder";
import { formatReminderOffset } from "../../../notifications/reminderRules";

type Props = {
  disabled: boolean;
  disabledMessage?: string | undefined;
  error?: string | undefined;
  onChange(value: ReminderOffsetMinutes[]): void;
  value: ReminderOffsetMinutes[];
};

export function ReminderOffsetSelector({
  disabled,
  disabledMessage,
  error,
  onChange,
  value
}: Props) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>Reminders</Text>
      <Text style={styles.helper}>
        {disabled
          ? (disabledMessage ?? "Turn on reminders in Settings to choose them here.")
          : `Optional. Choose up to ${maxRemindersPerItem}. ${value.length} selected. Only future reminder times are scheduled; your choices stay saved.`}
      </Text>
      <View style={styles.options}>
        {reminderSelectionOptions.map((offset) => {
          const checked = value.includes(offset);
          const atLimit = value.length >= maxRemindersPerItem && !checked;
          const label = formatReminderOffset(offset);

          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled: disabled || atLimit }}
              disabled={disabled || atLimit}
              key={offset}
              onPress={() =>
                onChange(
                  checked
                    ? value.filter((candidate) => candidate !== offset)
                    : [...value, offset]
                )
              }
              style={({ pressed }) => [
                styles.option,
                checked && styles.optionSelected,
                (disabled || atLimit) && styles.optionDisabled,
                pressed && styles.pressed
              ]}
            >
              <View style={[styles.checkbox, checked && styles.checkboxSelected]}>
                {checked ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
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
  checkbox: {
    borderColor: "#77716a",
    borderRadius: 4,
    borderWidth: 2,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    width: 20
  },
  checkboxSelected: {
    backgroundColor: "#2f5d62",
    borderColor: "#2f5d62"
  },
  checkmark: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
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

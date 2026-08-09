import DateTimePicker, {
  DateTimePickerEvent
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LocalDateString, LocalTimeString } from "../types/dateTime";
import {
  formatLocalDateForDisplay,
  getLocalDateString,
  getLocalTimeString,
  normalizeLocalDateInput,
  normalizeOptionalTime
} from "../utils/dates";

type CommonProps = {
  accessibilityLabel: string;
  disabled?: boolean;
};

export function NativeDatePickerButton({
  accessibilityLabel,
  disabled = false,
  onChange,
  value
}: CommonProps & {
  onChange(value: LocalDateString): void;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedValue = normalizeLocalDateInput(value);
  const pickerValue = normalizedValue ? localDateToDate(normalizedValue) : new Date();

  function handleChange(event: DateTimePickerEvent, selectedDate?: Date) {
    setIsOpen(false);

    if (event.type === "set" && selectedDate) {
      onChange(getLocalDateString(selectedDate));
    }
  }

  return (
    <View>
      <Pressable
        accessibilityHint="Opens the date picker"
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
          disabled && styles.disabled
        ]}
      >
        <Text style={styles.buttonText}>
          {normalizedValue ? formatLocalDateForDisplay(normalizedValue) : "Choose date"}
        </Text>
      </Pressable>
      {isOpen ? (
        <DateTimePicker
          display="default"
          mode="date"
          onChange={handleChange}
          value={pickerValue}
        />
      ) : null}
    </View>
  );
}

export function NativeTimePickerButton({
  accessibilityLabel,
  disabled = false,
  onChange,
  value
}: CommonProps & {
  onChange(value: LocalTimeString): void;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedValue = normalizeOptionalTime(value);
  const pickerValue = normalizedValue ? localTimeToDate(normalizedValue) : new Date();

  function handleChange(event: DateTimePickerEvent, selectedDate?: Date) {
    setIsOpen(false);

    if (event.type === "set" && selectedDate) {
      onChange(getLocalTimeString(selectedDate));
    }
  }

  return (
    <View>
      <Pressable
        accessibilityHint="Opens the time picker"
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
          disabled && styles.disabled
        ]}
      >
        <Text style={styles.buttonText}>
          {normalizedValue ? formatTimeForDisplay(normalizedValue) : "Choose time"}
        </Text>
      </Pressable>
      {isOpen ? (
        <DateTimePicker
          display="default"
          mode="time"
          onChange={handleChange}
          value={pickerValue}
        />
      ) : null}
    </View>
  );
}

function localDateToDate(value: LocalDateString): Date {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function localTimeToDate(value: LocalTimeString): Date {
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hour ?? 0, minute ?? 0, 0, 0);

  return date;
}

function formatTimeForDisplay(value: LocalTimeString): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(localTimeToDate(value));
}

const styles = StyleSheet.create({
  button: {
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    borderColor: "#cfc8bd",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  buttonText: {
    color: "#2f2d2a",
    fontSize: 16,
    fontWeight: "600"
  },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 }
});

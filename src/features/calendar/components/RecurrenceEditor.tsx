import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { NativeDatePickerButton } from "../../../components/NativeDateTimePickerButton";
import {
  CalendarRecurrenceRule,
  CalendarWeekday,
  RecurrenceEnd
} from "../../../types/calendarEvent";
import { LocalDateString } from "../../../types/dateTime";
import {
  buildPresetRecurrence,
  getOrdinalLabel,
  getRecurrencePreset,
  recurrencePresets,
  RecurrencePreset,
  weekdayOptions
} from "../recurrenceRules";
import { getOrdinalWeekday, getWeekday } from "../recurrence";

type Props = {
  date: LocalDateString;
  disabled?: boolean;
  error?: string | undefined;
  onChange(value: CalendarRecurrenceRule | null): void;
  value: CalendarRecurrenceRule | null;
};

export function RecurrenceEditor({
  date,
  disabled = false,
  error,
  onChange,
  value
}: Props) {
  const [preset, setPreset] = useState<RecurrencePreset>(() =>
    getRecurrencePreset(value, date)
  );

  useEffect(() => {
    if (!disabled && preset !== "none" && preset !== "custom") {
      onChange(buildPresetRecurrence(preset, date));
    }
  }, [date, disabled, onChange, preset]);

  function choosePreset(nextPreset: RecurrencePreset) {
    setPreset(nextPreset);

    if (nextPreset === "none") {
      onChange(null);
    } else if (nextPreset === "custom") {
      onChange(value ?? { frequency: "daily", interval: 1, end: { kind: "never" } });
    } else {
      onChange(buildPresetRecurrence(nextPreset, date));
    }
  }

  return (
    <View style={styles.group}>
      <Text style={styles.label}>Repeat</Text>
      {disabled ? (
        <Text style={styles.disabledText}>
          This occurrence keeps the series repeat pattern.
        </Text>
      ) : (
        <View accessibilityRole="radiogroup" style={styles.choices}>
          {recurrencePresets.map((option) => {
            const selected = option === preset;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option}
                onPress={() => choosePreset(option)}
                style={({ pressed }) => [
                  styles.choice,
                  selected && styles.choiceSelected,
                  pressed && styles.pressed
                ]}
              >
                <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                  {getPresetLabel(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {!disabled && preset === "custom" && value ? (
        <CustomRecurrenceEditor date={date} onChange={onChange} value={value} />
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function CustomRecurrenceEditor({
  date,
  onChange,
  value
}: {
  date: LocalDateString;
  onChange(value: CalendarRecurrenceRule): void;
  value: CalendarRecurrenceRule;
}) {
  function changeFrequency(frequency: CalendarRecurrenceRule["frequency"]) {
    const end = value.end;
    const interval = value.interval;

    if (frequency === "daily") {
      onChange({ frequency, interval, end });
    } else if (frequency === "weekly") {
      onChange({ frequency, interval, weekdays: [getWeekday(date)], end });
    } else if (frequency === "monthly") {
      onChange({
        frequency,
        interval,
        monthlyPattern: { kind: "same_date" },
        end
      });
    } else {
      onChange({ frequency, interval, end });
    }
  }

  function changeInterval(input: string) {
    const interval = Number(input.replace(/\D/g, "")) || 1;
    onChange({ ...value, interval });
  }

  return (
    <View style={styles.advancedPanel}>
      <Text style={styles.advancedTitle}>Custom repeat</Text>
      <View style={styles.inlineRow}>
        <Text style={styles.inlineLabel}>Every</Text>
        <TextInput
          accessibilityLabel="Repeat interval"
          keyboardType="number-pad"
          onChangeText={changeInterval}
          style={styles.numberInput}
          value={String(value.interval)}
        />
      </View>
      <View accessibilityRole="radiogroup" style={styles.choices}>
        {(["daily", "weekly", "monthly", "yearly"] as const).map((frequency) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: value.frequency === frequency }}
            key={frequency}
            onPress={() => changeFrequency(frequency)}
            style={({ pressed }) => [
              styles.choice,
              value.frequency === frequency && styles.choiceSelected,
              pressed && styles.pressed
            ]}
          >
            <Text
              style={[
                styles.choiceText,
                value.frequency === frequency && styles.choiceTextSelected
              ]}
            >
              {getFrequencyUnit(frequency)}
            </Text>
          </Pressable>
        ))}
      </View>

      {value.frequency === "weekly" ? (
        <WeekdayChoices
          onChange={(weekdays) => onChange({ ...value, weekdays })}
          value={value.weekdays}
        />
      ) : null}

      {value.frequency === "monthly" ? (
        <MonthlyChoices
          date={date}
          onChange={(monthlyPattern) => onChange({ ...value, monthlyPattern })}
          value={value.monthlyPattern}
        />
      ) : null}

      <EndChoices
        anchorDate={date}
        onChange={(end) => onChange({ ...value, end })}
        value={value.end}
      />
      {value.frequency === "yearly" && date.slice(5) === "02-29" ? (
        <Text style={styles.helpText}>Leap-day events occur only in leap years.</Text>
      ) : null}
    </View>
  );
}

function WeekdayChoices({
  onChange,
  value
}: {
  onChange(value: CalendarWeekday[]): void;
  value: CalendarWeekday[];
}) {
  return (
    <View style={styles.subgroup}>
      <Text style={styles.subgroupLabel}>On weekdays</Text>
      <View style={styles.choices}>
        {weekdayOptions.map((option) => {
          const selected = value.includes(option.value);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() =>
                onChange(
                  selected
                    ? value.filter((weekday) => weekday !== option.value)
                    : [...value, option.value].sort()
                )
              }
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceSelected,
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                {option.label.slice(0, 3)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MonthlyChoices({
  date,
  onChange,
  value
}: {
  date: LocalDateString;
  onChange(
    value: Extract<CalendarRecurrenceRule, { frequency: "monthly" }>["monthlyPattern"]
  ): void;
  value: Extract<CalendarRecurrenceRule, { frequency: "monthly" }>["monthlyPattern"];
}) {
  const anchorPattern = getOrdinalWeekday(date);
  return (
    <View style={styles.subgroup}>
      <Text style={styles.subgroupLabel}>Monthly pattern</Text>
      <View style={styles.choices}>
        <Choice
          selected={value.kind === "same_date"}
          label={`Same date (${Number(date.slice(8))})`}
          onPress={() => onChange({ kind: "same_date" })}
        />
        <Choice
          selected={value.kind === "ordinal_weekday"}
          label={`${getOrdinalLabel(anchorPattern.ordinal)} ${weekdayOptions[anchorPattern.weekday]?.label}`}
          onPress={() => onChange({ kind: "ordinal_weekday", ...anchorPattern })}
        />
      </View>
    </View>
  );
}

function EndChoices({
  anchorDate,
  onChange,
  value
}: {
  anchorDate: LocalDateString;
  onChange(value: RecurrenceEnd): void;
  value: RecurrenceEnd;
}) {
  return (
    <View style={styles.subgroup}>
      <Text style={styles.subgroupLabel}>Ends</Text>
      <View style={styles.choices}>
        <Choice
          selected={value.kind === "never"}
          label="Never"
          onPress={() => onChange({ kind: "never" })}
        />
        <Choice
          selected={value.kind === "on_date"}
          label="On date"
          onPress={() => onChange({ kind: "on_date", date: anchorDate })}
        />
        <Choice
          selected={value.kind === "after_count"}
          label="After count"
          onPress={() => onChange({ kind: "after_count", count: 10 })}
        />
      </View>
      {value.kind === "on_date" ? (
        <NativeDatePickerButton
          accessibilityLabel="Choose repeat end date"
          onChange={(date) =>
            onChange({ kind: "on_date", date: date as LocalDateString })
          }
          value={value.date}
        />
      ) : null}
      {value.kind === "after_count" ? (
        <TextInput
          accessibilityLabel="Number of occurrences"
          keyboardType="number-pad"
          onChangeText={(input) =>
            onChange({
              kind: "after_count",
              count: Number(input.replace(/\D/g, "")) || 1
            })
          }
          style={styles.numberInput}
          value={String(value.count)}
        />
      ) : null}
    </View>
  );
}

function Choice({
  selected,
  label,
  onPress
}: {
  selected: boolean;
  label: string;
  onPress(): void;
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

function getPresetLabel(preset: RecurrencePreset): string {
  return (
    {
      none: "Doesn't repeat",
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      yearly: "Yearly",
      custom: "Custom"
    } as const
  )[preset];
}

function getFrequencyUnit(frequency: CalendarRecurrenceRule["frequency"]): string {
  return (
    { daily: "Days", weekly: "Weeks", monthly: "Months", yearly: "Years" } as const
  )[frequency];
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { color: "#2f2d2a", fontSize: 16, fontWeight: "700" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#aaa49a",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12
  },
  choiceSelected: { backgroundColor: "#edf4f2", borderColor: "#2f5d62", borderWidth: 2 },
  choiceText: { color: "#4a4742", fontSize: 14, fontWeight: "600" },
  choiceTextSelected: { color: "#244b4f", fontWeight: "800" },
  advancedPanel: {
    backgroundColor: "#f1f0eb",
    borderColor: "#d5d0c7",
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 14
  },
  advancedTitle: { color: "#35322e", fontSize: 15, fontWeight: "800" },
  inlineRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  inlineLabel: { color: "#4a4742", fontSize: 15, fontWeight: "700" },
  numberInput: {
    backgroundColor: "#fff",
    borderColor: "#aaa49a",
    borderRadius: 8,
    borderWidth: 1,
    color: "#2f2d2a",
    fontSize: 16,
    minHeight: 44,
    minWidth: 88,
    paddingHorizontal: 12
  },
  subgroup: { gap: 8 },
  subgroupLabel: { color: "#4a4742", fontSize: 14, fontWeight: "700" },
  disabledText: { color: "#68645e", fontSize: 14, lineHeight: 20 },
  helpText: { color: "#5c625e", fontSize: 13, lineHeight: 19 },
  errorText: { color: "#8d3434", fontSize: 14 },
  pressed: { opacity: 0.7 }
});

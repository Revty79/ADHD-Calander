import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import {
  NativeDatePickerButton,
  NativeTimePickerButton
} from "../../../components/NativeDateTimePickerButton";
import { TaskValidationError } from "../../../database/repositories/errors";
import { ReminderOffsetMinutes, ReminderPermissionStatus } from "../../../types/reminder";
import {
  CreateTaskInput,
  getTaskPlanningState,
  Task,
  TaskImportance,
  TaskPlanningState
} from "../../../types/task";
import { ReminderOffsetSelector } from "../../reminders/components/ReminderOffsetSelector";
import { useReminderSettings } from "../../settings/hooks/useReminderSettings";
import {
  getDeadlineQuickChoices,
  getPlannedDateQuickChoices,
  TaskDateQuickChoice
} from "../taskDateChoices";

type FieldErrors = Partial<Record<TaskValidationError["field"], string>>;

type Props = {
  initialDate?: string;
  initialTask?: Task;
  onSubmit(input: CreateTaskInput): Promise<void>;
  submitLabel: string;
};

const durationOptions = [null, 10, 15, 30, 45, 60, 90, 120] as const;
const importanceOptions: { label: string; value: TaskImportance }[] = [
  { label: "Low", value: "low" },
  { label: "Normal", value: "normal" },
  { label: "Important", value: "important" }
];
const planningOptions: { label: string; value: TaskPlanningState }[] = [
  { label: "Flexible", value: "flexible" },
  { label: "Planned", value: "planned" },
  { label: "Scheduled", value: "scheduled" }
];

export function TaskEditorForm({
  initialDate = "",
  initialTask,
  onSubmit,
  submitLabel
}: Props) {
  const reminderSettings = useReminderSettings();
  const [title, setTitle] = useState(initialTask?.title ?? "");
  const [description, setDescription] = useState(initialTask?.description ?? "");
  const [importance, setImportance] = useState<TaskImportance>(
    initialTask?.importance ?? "normal"
  );
  const [planningState, setPlanningState] = useState<TaskPlanningState>(
    initialTask ? getTaskPlanningState(initialTask) : initialDate ? "planned" : "flexible"
  );
  const [scheduledDate, setScheduledDate] = useState(
    initialTask?.scheduledDate ?? initialDate
  );
  const [scheduledTime, setScheduledTime] = useState(initialTask?.scheduledTime ?? "");
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState<number | null>(
    initialTask?.estimatedDurationMinutes ?? null
  );
  const [deadlineDate, setDeadlineDate] = useState(initialTask?.deadlineDate ?? "");
  const [reminderOffsets, setReminderOffsets] = useState<ReminderOffsetMinutes[]>(
    initialTask?.reminderOffsets ?? []
  );
  const [referenceDate] = useState(() => new Date());
  const [showDetails, setShowDetails] = useState(Boolean(initialTask || initialDate));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function choosePlanningState(nextState: TaskPlanningState) {
    setPlanningState(nextState);

    if (nextState === "flexible") {
      setScheduledDate("");
      setScheduledTime("");
    } else if (nextState === "planned") {
      setScheduledTime("");
    } else if (!scheduledDate) {
      setScheduledDate(getPlannedDateQuickChoices(referenceDate)[0]?.value ?? "");
    }
  }

  async function saveTask() {
    setFieldErrors({});
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await onSubmit({
        title,
        description,
        importance,
        scheduledDate: planningState === "flexible" ? null : scheduledDate,
        scheduledTime: planningState === "scheduled" ? scheduledTime : null,
        estimatedDurationMinutes,
        deadlineDate,
        reminderOffsets
      });
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

  const reminderDisabledMessage = getReminderDisabledMessage(
    planningState,
    reminderSettings.status?.permissionStatus,
    reminderSettings.status?.settings.remindersEnabled
  );

  return (
    <View style={styles.form}>
      <Field label="Title" error={fieldErrors.title}>
        <TextInput
          accessibilityLabel="Task title"
          autoCapitalize="sentences"
          onChangeText={setTitle}
          placeholder="What needs doing?"
          style={[styles.input, fieldErrors.title ? styles.inputError : null]}
          value={title}
        />
      </Field>

      {!showDetails ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowDetails(true)}
          style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}
        >
          <Text style={styles.detailsButtonText}>Add planning details</Text>
        </Pressable>
      ) : (
        <View style={styles.details}>
          <Field label="Notes">
            <TextInput
              accessibilityLabel="Task notes"
              multiline
              onChangeText={setDescription}
              placeholder="Optional context or next step"
              style={[styles.input, styles.multilineInput]}
              textAlignVertical="top"
              value={description}
            />
          </Field>

          <ChoiceGroup<TaskImportance>
            label="Importance"
            onChange={setImportance}
            options={importanceOptions}
            value={importance}
          />

          <ChoiceGroup<TaskPlanningState>
            help="Flexible has no date. Planned has a date. Scheduled has a date and time."
            label="Planning state"
            onChange={choosePlanningState}
            options={planningOptions}
            value={planningState}
          />

          {planningState !== "flexible" ? (
            <Field label="Planned date" error={fieldErrors.scheduledDate}>
              <DateQuickChoices
                choices={getPlannedDateQuickChoices(referenceDate)}
                onChange={(value) => setScheduledDate(value ?? "")}
                value={scheduledDate}
              />
              <NativeDatePickerButton
                accessibilityLabel="Choose a planned date"
                onChange={setScheduledDate}
                value={scheduledDate}
              />
              <Pressable
                accessibilityLabel="Clear planned date and make task flexible"
                accessibilityRole="button"
                onPress={() => choosePlanningState("flexible")}
                style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
              >
                <Text style={styles.clearButtonText}>Clear date · Make flexible</Text>
              </Pressable>
            </Field>
          ) : null}

          {planningState === "scheduled" ? (
            <Field label="Scheduled time" error={fieldErrors.scheduledTime}>
              <NativeTimePickerButton
                accessibilityLabel="Choose a scheduled time"
                onChange={setScheduledTime}
                value={scheduledTime}
              />
            </Field>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Estimated duration</Text>
            <Text style={styles.helpText}>Choose a practical estimate if it helps.</Text>
            <View accessibilityRole="radiogroup" style={styles.optionWrap}>
              {durationOptions.map((duration) => {
                const selected = duration === estimatedDurationMinutes;
                const label = duration === null ? "No estimate" : `${duration} min`;

                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    key={duration ?? "none"}
                    onPress={() => setEstimatedDurationMinutes(duration)}
                    style={({ pressed }) => [
                      styles.choice,
                      selected && styles.choiceSelected,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text
                      style={[styles.choiceText, selected && styles.choiceTextSelected]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {fieldErrors.estimatedDurationMinutes ? (
              <Text accessibilityRole="alert" style={styles.validationText}>
                {fieldErrors.estimatedDurationMinutes}
              </Text>
            ) : null}
          </View>

          <Field label="Deadline" error={fieldErrors.deadlineDate}>
            <DateQuickChoices
              choices={getDeadlineQuickChoices(referenceDate)}
              onChange={(value) => setDeadlineDate(value ?? "")}
              value={deadlineDate}
            />
            <NativeDatePickerButton
              accessibilityLabel="Choose a custom deadline date"
              onChange={setDeadlineDate}
              value={deadlineDate}
            />
            <Text style={styles.helpText}>
              A deadline is the last day to finish, not when you plan to work.
            </Text>
          </Field>

          {planningState === "scheduled" ? (
            <ReminderOffsetSelector
              disabled={Boolean(reminderDisabledMessage)}
              {...(reminderDisabledMessage
                ? { disabledMessage: reminderDisabledMessage }
                : {})}
              error={fieldErrors.reminderOffsets}
              onChange={setReminderOffsets}
              value={reminderOffsets}
            />
          ) : null}

          {planningState !== "scheduled" && reminderOffsets.length > 0 ? (
            <Text style={styles.helpText}>
              Saved reminder choices are inactive until this task has a date and time.
            </Text>
          ) : null}
        </View>
      )}

      {errorMessage ? (
        <Text accessibilityRole="alert" style={styles.errorNotice}>
          {errorMessage}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={saveTask}
        style={({ pressed }) => [
          styles.saveButton,
          pressed && styles.pressed,
          isSaving && styles.disabled
        ]}
      >
        {isSaving ? (
          <ActivityIndicator accessibilityLabel="Saving task" color="#ffffff" />
        ) : (
          <Text style={styles.saveButtonText}>{submitLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

function DateQuickChoices({
  choices,
  onChange,
  value
}: {
  choices: TaskDateQuickChoice[];
  onChange(value: string | null): void;
  value: string;
}) {
  return (
    <View style={styles.optionWrap}>
      {choices.map((choice) => {
        const choiceValue = choice.value ?? "";
        const selected = value === choiceValue;

        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={choice.label}
            onPress={() => onChange(choice.value)}
            style={({ pressed }) => [
              styles.choice,
              selected && styles.choiceSelected,
              pressed && styles.pressed
            ]}
          >
            <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
              {choice.label}
            </Text>
          </Pressable>
        );
      })}
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
        <Text accessibilityRole="alert" style={styles.validationText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function ChoiceGroup<T extends string>({
  help,
  label,
  onChange,
  options,
  value
}: {
  help?: string | undefined;
  label: string;
  onChange(value: T): void;
  options: { label: string; value: T }[];
  value: T;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {help ? <Text style={styles.helpText}>{help}</Text> : null}
      <View style={styles.optionWrap}>
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceSelected,
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function getReminderDisabledMessage(
  planningState: TaskPlanningState,
  permissionStatus: ReminderPermissionStatus | undefined,
  remindersEnabled: boolean | undefined
): string | null {
  if (planningState !== "scheduled") {
    return "Reminders are available after adding a date and time.";
  }

  if (permissionStatus === "denied" || permissionStatus === "unsupported") {
    return "Reminders are unavailable on this device or browser.";
  }

  if (remindersEnabled !== true) {
    return "Turn on reminders in Settings to choose them here.";
  }

  return null;
}

const styles = StyleSheet.create({
  form: { gap: 18 },
  details: { gap: 20 },
  field: { gap: 8 },
  label: { color: "#2f2d2a", fontSize: 16, fontWeight: "700" },
  helpText: { color: "#68645e", fontSize: 13, lineHeight: 19 },
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
  inputError: { borderColor: "#a53f3f" },
  multilineInput: { minHeight: 96 },
  validationText: { color: "#8d3434", fontSize: 14 },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  detailsButton: {
    alignItems: "center",
    borderColor: "#2f5d62",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16
  },
  detailsButtonText: { color: "#2f5d62", fontSize: 16, fontWeight: "700" },
  clearButton: {
    alignItems: "center",
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
  saveButtonText: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
  errorNotice: {
    backgroundColor: "#fff8f6",
    borderColor: "#d6aaa2",
    borderRadius: 8,
    borderWidth: 1,
    color: "#593832",
    fontSize: 14,
    lineHeight: 20,
    padding: 14
  },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.75 }
});

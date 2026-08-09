import Constants from "expo-constants";
import { useCallback } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";

import { ErrorNotice } from "../../src/components/ErrorNotice";
import { Screen } from "../../src/components/Screen";
import { useReminderSettings } from "../../src/features/settings/hooks/useReminderSettings";
import { usePlanningSettings } from "../../src/features/settings/hooks/usePlanningSettings";
import {
  maxSuggestedTaskMinutesOptions,
  planningDayEndOptions,
  planningDayStartOptions,
  PlanningPreferences,
  transitionBufferOptions
} from "../../src/types/settings";

export default function SettingsScreen() {
  const reminders = useReminderSettings();
  const planning = usePlanningSettings();
  const reminderEnabled = reminders.status?.settings.remindersEnabled ?? false;
  const permissionStatus = reminders.status?.permissionStatus;
  const version = Constants.expoConfig?.version ?? "0.1.0";

  const toggleReminders = useCallback(
    (enabled: boolean) => {
      void reminders.setRemindersEnabled(enabled);
    },
    [reminders]
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Settings
        </Text>
        <Text style={styles.intro}>
          Adjust the parts of planning that should work differently for you.
        </Text>
      </View>

      {reminders.errorMessage ? (
        <ErrorNotice message={reminders.errorMessage} onRetry={reminders.refresh} />
      ) : null}

      <SettingsSection
        description="Reminders can help you notice a plan without adding pressure."
        title="Reminders"
      >
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingLabel}>Allow local reminders</Text>
            <Text style={styles.settingDescription}>
              When enabled, a task or event can have several optional reminders on this
              device.
            </Text>
          </View>
          {reminders.isLoading ? (
            <ActivityIndicator accessibilityLabel="Loading reminder settings" />
          ) : (
            <Switch
              accessibilityHint="Controls all task and event reminders"
              accessibilityLabel="Allow local reminders"
              disabled={reminders.isSaving || permissionStatus === "unsupported"}
              onValueChange={toggleReminders}
              trackColor={{ false: "#aaa39a", true: "#7fa39b" }}
              thumbColor={reminderEnabled ? "#2f5d62" : "#f4f1ea"}
              value={reminderEnabled}
            />
          )}
        </View>

        <Text accessibilityLiveRegion="polite" style={styles.statusText}>
          {getPermissionMessage(permissionStatus, reminderEnabled)}
        </Text>

        {permissionStatus === "denied" ? (
          <View style={styles.inlineActions}>
            <SettingsButton label="Open device settings" onPress={Linking.openSettings} />
            <SettingsButton label="Check again" onPress={reminders.refresh} secondary />
          </View>
        ) : null}
      </SettingsSection>

      {planning.errorMessage ? (
        <ErrorNotice message={planning.errorMessage} onRetry={planning.refresh} />
      ) : null}

      <SettingsSection
        description="These boundaries keep suggestions conservative. They are planning defaults, not claims about your capacity."
        title="Planning"
      >
        {planning.isLoading || planning.settings === null ? (
          <ActivityIndicator accessibilityLabel="Loading planning settings" />
        ) : (
          <>
            <PlanningChoiceGroup
              disabled={planning.isSaving}
              label="Planning day starts"
              onChange={(value) =>
                void planning.setPreference(
                  "planningDayStart",
                  value as PlanningPreferences["planningDayStart"]
                )
              }
              options={planningDayStartOptions.map((value) => ({
                label: formatPlanningTime(value),
                value
              }))}
              selectedValue={planning.settings.planningDayStart}
            />
            <PlanningChoiceGroup
              disabled={planning.isSaving}
              label="Planning day ends"
              onChange={(value) =>
                void planning.setPreference(
                  "planningDayEnd",
                  value as PlanningPreferences["planningDayEnd"]
                )
              }
              options={planningDayEndOptions.map((value) => ({
                label: formatPlanningTime(value),
                value
              }))}
              selectedValue={planning.settings.planningDayEnd}
            />
            <PlanningChoiceGroup
              disabled={planning.isSaving}
              label="Transition time around fixed events"
              onChange={(value) =>
                void planning.setPreference(
                  "transitionBufferMinutes",
                  value as PlanningPreferences["transitionBufferMinutes"]
                )
              }
              options={transitionBufferOptions.map((value) => ({
                label: value === 0 ? "None" : `${value} min`,
                value
              }))}
              selectedValue={planning.settings.transitionBufferMinutes}
            />
            <PlanningChoiceGroup
              disabled={planning.isSaving}
              label="Most suggested task time per day"
              onChange={(value) =>
                void planning.setPreference(
                  "maxSuggestedTaskMinutesPerDay",
                  value as PlanningPreferences["maxSuggestedTaskMinutesPerDay"]
                )
              }
              options={maxSuggestedTaskMinutesOptions.map((value) => ({
                label: `${value / 60} hr`,
                value
              }))}
              selectedValue={planning.settings.maxSuggestedTaskMinutesPerDay}
            />
            <Text style={styles.planningNote}>
              Suggestions search seven days by default and never fill time without your
              confirmation.
            </Text>
          </>
        )}
      </SettingsSection>

      <SettingsSection
        description="ADHD Calendar follows your device accessibility choices."
        title="Accessibility"
      >
        <InfoRow
          label="Text size"
          value="Uses your device font-size preference, including larger text."
        />
        <InfoRow
          label="Reduced motion"
          value="No planning action depends on animation or motion."
        />
        <InfoRow
          label="Controls"
          value="Primary controls use clear labels and comfortable touch targets."
        />
      </SettingsSection>

      <SettingsSection
        description="Core planning data stays in the app's local database."
        title="Data and privacy"
      >
        <InfoRow
          label="Storage"
          value="Tasks, events, Recovery, and settings stay local."
        />
        <InfoRow label="Accounts" value="No account or cloud connection is required." />
        <InfoRow
          label="Notifications"
          value="Reminder content is scheduled on this device."
        />
      </SettingsSection>

      <SettingsSection title="About">
        <InfoRow label="App" value="ADHD Calendar" />
        <InfoRow label="Version" value={version} />
        <InfoRow
          label="Privacy policy"
          value="A formal policy link will be added during Google Play release preparation."
        />
        <Text style={styles.aboutText}>
          A recovery-first planning tool. It is not a therapist, diagnostic service, or
          medical device.
        </Text>
      </SettingsSection>
    </Screen>
  );
}

function SettingsSection({
  children,
  description,
  title
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <View accessibilityRole="summary" style={styles.panel}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function PlanningChoiceGroup({
  disabled,
  label,
  onChange,
  options,
  selectedValue
}: {
  disabled: boolean;
  label: string;
  onChange(value: string | number): void;
  options: { label: string; value: string | number }[];
  selectedValue: string | number;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.choiceGroup}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => {
          const selected = option.value === selectedValue;

          return (
            <Pressable
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceSelected,
                disabled && styles.disabledButton,
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

function formatPlanningTime(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date(2026, 0, 1, hours ?? 0, minutes ?? 0);

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function SettingsButton({
  label,
  onPress,
  secondary = false
}: {
  label: string;
  onPress(): void | Promise<void>;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        pressed && styles.pressed
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>
        {label}
      </Text>
    </Pressable>
  );
}

function getPermissionMessage(
  permissionStatus: "granted" | "denied" | "undetermined" | "unsupported" | undefined,
  reminderEnabled: boolean
): string {
  if (permissionStatus === "unsupported") {
    return "Local reminders are not supported on this platform.";
  }

  if (permissionStatus === "denied") {
    return "Notification permission is off. You can change it in device settings whenever you want.";
  }

  if (permissionStatus === "granted" && reminderEnabled) {
    return "Reminders are available. Existing future reminders are kept in sync.";
  }

  if (permissionStatus === "granted") {
    return "Permission is available. Reminders are currently off.";
  }

  return "Permission is requested only when you turn reminders on.";
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
    marginBottom: 18
  },
  title: {
    color: "#2f2d2a",
    fontSize: 30,
    fontWeight: "800"
  },
  intro: {
    color: "#4a4742",
    fontSize: 16,
    lineHeight: 23
  },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#ded9cf",
    borderRadius: 10,
    borderWidth: 1,
    gap: 7,
    marginBottom: 16,
    padding: 18
  },
  sectionTitle: {
    color: "#2f2d2a",
    fontSize: 21,
    fontWeight: "700"
  },
  sectionDescription: {
    color: "#4f5c54",
    fontSize: 15,
    lineHeight: 22
  },
  sectionContent: {
    gap: 14,
    marginTop: 8
  },
  settingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
    minHeight: 52
  },
  settingCopy: {
    flex: 1,
    gap: 3
  },
  settingLabel: {
    color: "#2f2d2a",
    fontSize: 16,
    fontWeight: "700"
  },
  settingDescription: {
    color: "#68645e",
    fontSize: 14,
    lineHeight: 20
  },
  statusText: {
    backgroundColor: "#f1f4ef",
    borderRadius: 8,
    color: "#3f554e",
    fontSize: 14,
    lineHeight: 21,
    padding: 12
  },
  inlineActions: {
    gap: 10
  },
  button: {
    alignItems: "center",
    backgroundColor: "#2f5d62",
    borderColor: "#2f5d62",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16
  },
  secondaryButton: {
    backgroundColor: "#ffffff"
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  secondaryButtonText: {
    color: "#2f5d62"
  },
  infoRow: {
    borderTopColor: "#ebe7df",
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 12
  },
  infoLabel: {
    color: "#2f2d2a",
    fontSize: 15,
    fontWeight: "700"
  },
  infoValue: {
    color: "#5e5a54",
    fontSize: 14,
    lineHeight: 20
  },
  aboutText: {
    color: "#5e5a54",
    fontSize: 14,
    lineHeight: 21
  },
  choiceGroup: {
    gap: 8
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  choice: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#aaa39a",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 82,
    paddingHorizontal: 12
  },
  choiceSelected: {
    backgroundColor: "#edf4f2",
    borderColor: "#2f5d62",
    borderWidth: 2
  },
  choiceText: {
    color: "#4a4742",
    fontSize: 15,
    fontWeight: "600"
  },
  choiceTextSelected: {
    color: "#244b4f",
    fontWeight: "800"
  },
  planningNote: {
    color: "#5e5a54",
    fontSize: 14,
    lineHeight: 21
  },
  disabledButton: {
    opacity: 0.6
  },
  pressed: {
    opacity: 0.75
  }
});

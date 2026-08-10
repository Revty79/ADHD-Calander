import Constants from "expo-constants";

import { useReminderSettings } from "../../src/features/settings/hooks/useReminderSettings";
import { usePlanningSettings } from "../../src/features/settings/hooks/usePlanningSettings";
import {
  formatPlanningTime,
  formatSuggestedTaskTimeOption,
  formatTransitionBufferOption,
  planningSettingsSummary
} from "../../src/features/settings/planningPresentation";
import {
  maxSuggestedTaskMinutesOptions,
  planningDayEndOptions,
  planningDayStartOptions,
  PlanningPreferences,
  transitionBufferOptions
} from "../../src/types/settings";

export default function WebSettingsScreen() {
  const reminders = useReminderSettings();
  const planning = usePlanningSettings();
  const version = Constants.expoConfig?.version ?? "0.1.0";

  return (
    <div className="web-page web-settings-page">
      <header className="web-page-header">
        <div>
          <p className="web-eyebrow">Local preferences</p>
          <h1>Settings</h1>
          <p>Clear information about how planning works on this browser.</p>
        </div>
      </header>

      <div className="web-settings-grid">
        <SettingsSection
          description="Reminders can help you notice a plan without adding pressure."
          title="Reminders"
        >
          <div className="web-settings-status" role="status">
            <strong>Android app only</strong>
            <span>
              This browser does not schedule task or event notifications. No browser
              permission will be requested.
            </span>
          </div>
          <InfoRow
            label="Current browser support"
            value={
              reminders.isLoading
                ? "Checking support..."
                : reminders.status?.permissionStatus === "unsupported"
                  ? "Not supported"
                  : "Available"
            }
          />
        </SettingsSection>

        <SettingsSection
          description="These boundaries keep suggestions conservative. They are planning defaults, not claims about your capacity."
          title="Planning"
        >
          {planning.errorMessage ? (
            <p className="web-validation-message" role="alert">
              {planning.errorMessage}
            </p>
          ) : null}
          {planning.isLoading || planning.settings === null ? (
            <p aria-live="polite" role="status">
              Loading planning settings...
            </p>
          ) : (
            <div className="web-settings-controls">
              <PlanningSelect
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
                value={planning.settings.planningDayStart}
              />
              <PlanningSelect
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
                value={planning.settings.planningDayEnd}
              />
              <PlanningSelect
                disabled={planning.isSaving}
                label="Transition time around fixed events"
                onChange={(value) =>
                  void planning.setPreference(
                    "transitionBufferMinutes",
                    Number(value) as PlanningPreferences["transitionBufferMinutes"]
                  )
                }
                options={transitionBufferOptions.map((value) => ({
                  label: formatTransitionBufferOption(value),
                  value: String(value)
                }))}
                value={String(planning.settings.transitionBufferMinutes)}
              />
              <PlanningSelect
                disabled={planning.isSaving}
                label="Most suggested task time per day"
                onChange={(value) =>
                  void planning.setPreference(
                    "maxSuggestedTaskMinutesPerDay",
                    Number(value) as PlanningPreferences["maxSuggestedTaskMinutesPerDay"]
                  )
                }
                options={maxSuggestedTaskMinutesOptions.map((value) => ({
                  label: formatSuggestedTaskTimeOption(value),
                  value: String(value)
                }))}
                value={String(planning.settings.maxSuggestedTaskMinutesPerDay)}
              />
              <p className="web-form-hint">{planningSettingsSummary}</p>
            </div>
          )}
        </SettingsSection>

        <SettingsSection
          description="The interface respects browser and operating-system accessibility settings."
          title="Accessibility"
        >
          <InfoRow
            label="Text size"
            value="Use browser zoom or your system text settings."
          />
          <InfoRow
            label="Keyboard"
            value="Interactive controls have visible focus and semantic labels."
          />
          <InfoRow
            label="Reduced motion"
            value="Motion is removed when your system requests reduced motion."
          />
        </SettingsSection>

        <SettingsSection
          description="Core planning data stays in IndexedDB on this browser."
          title="Data and privacy"
        >
          <InfoRow
            label="Storage"
            value="Tasks, events, Recovery, and settings stay local."
          />
          <InfoRow label="Accounts" value="No account or cloud connection is required." />
          <InfoRow
            label="Notifications"
            value="This browser schedules no notifications."
          />
        </SettingsSection>

        <SettingsSection title="About">
          <InfoRow label="App" value="ADHD Calendar" />
          <InfoRow label="Version" value={version} />
          <InfoRow
            label="Privacy policy"
            value="A formal policy link will be added during Google Play release preparation."
          />
          <p className="web-settings-about">
            A recovery-first planning tool. It is not a therapist, diagnostic service, or
            medical device.
          </p>
        </SettingsSection>
      </div>
    </div>
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
    <section
      aria-labelledby={`settings-${title.toLowerCase().replaceAll(" ", "-")}`}
      className="web-panel web-settings-panel"
    >
      <h2 id={`settings-${title.toLowerCase().replaceAll(" ", "-")}`}>{title}</h2>
      {description ? <p className="web-settings-description">{description}</p> : null}
      <div className="web-settings-content">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <dl className="web-settings-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </dl>
  );
}

function PlanningSelect({
  disabled,
  label,
  onChange,
  options,
  value
}: {
  disabled: boolean;
  label: string;
  onChange(value: string): void;
  options: { label: string; value: string }[];
  value: string;
}) {
  const id = `planning-${label.toLowerCase().replaceAll(" ", "-")}`;

  return (
    <div className="web-settings-control">
      <label htmlFor={id}>{label}</label>
      <select
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

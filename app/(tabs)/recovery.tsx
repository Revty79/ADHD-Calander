import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { ErrorNotice } from "../../src/components/ErrorNotice";
import { Screen } from "../../src/components/Screen";
import { useRecoverySession } from "../../src/features/recovery/hooks/useRecoverySession";
import { getRecoveryDecisionLabel } from "../../src/features/recovery/recoveryPresentation";
import {
  getNextRecoveryItem,
  getResolvedRecoveryItemCount,
  RecoveryItem,
  RecoverySession
} from "../../src/types/recovery";
import {
  formatLocalDateForDisplay,
  getLocalDateString,
  normalizeLocalDateInput
} from "../../src/utils/dates";

type ActionMode = "reschedule" | "break_down" | "delegate" | "remove" | null;

export default function RecoveryScreen() {
  const params = useLocalSearchParams<{ sourceDate?: string }>();
  const initialSourceDate = useMemo(
    () => normalizeSourceDate(params.sourceDate),
    [params.sourceDate]
  );
  const [sourceDate, setSourceDate] = useState(initialSourceDate);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [rescheduledDate, setRescheduledDate] = useState("");
  const [rescheduledTime, setRescheduledTime] = useState("");
  const [breakdownTitles, setBreakdownTitles] = useState(["", ""]);
  const [delegateNote, setDelegateNote] = useState("");
  const recovery = useRecoverySession();
  const refreshRecovery = recovery.refresh;
  const currentItem = recovery.session ? getNextRecoveryItem(recovery.session) : null;

  useFocusEffect(
    useCallback(() => {
      refreshRecovery();
    }, [refreshRecovery])
  );

  const runAndClose = async (operation: () => Promise<boolean>) => {
    if (await operation()) {
      setActionMode(null);
      setRescheduledDate("");
      setRescheduledTime("");
      setBreakdownTitles(["", ""]);
      setDelegateNote("");
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.kicker}>A smaller next step</Text>
        <Text style={styles.title}>Recovery Mode</Text>
        <Text style={styles.intro}>
          Review unfinished tasks one at a time. Nothing is moved or removed until you
          choose it.
        </Text>
      </View>

      <View style={styles.fixedNotice} accessibilityRole="summary">
        <Text style={styles.fixedNoticeText}>
          Fixed appointments stay where they are. Recovery Mode only reviews tasks.
        </Text>
      </View>

      {recovery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator accessibilityLabel="Loading Recovery Mode" />
          <Text style={styles.mutedText}>Loading your recovery session...</Text>
        </View>
      ) : null}

      {recovery.errorMessage ? (
        <ErrorNotice message={recovery.errorMessage} onRetry={recovery.refresh} />
      ) : null}

      {!recovery.isLoading && !recovery.session ? (
        <StartPanel
          isSaving={recovery.isSaving}
          latestDate={recovery.latestCompletedSession?.sourceDate ?? null}
          onChangeDate={setSourceDate}
          onStart={() => recovery.startSession(sourceDate)}
          sourceDate={sourceDate}
        />
      ) : null}

      {recovery.session ? (
        <>
          <ProgressPanel session={recovery.session} />

          {currentItem ? (
            <View style={styles.reviewCard}>
              <Text style={styles.cardKicker}>
                {currentItem.decision === "skip" ? "Ready to revisit" : "Review"}
              </Text>
              <Text style={styles.taskTitle}>{currentItem.originalTitle}</Text>
              <View style={styles.metaRow}>
                {currentItem.originalScheduledTime ? (
                  <Text style={styles.metaText}>
                    Planned for {currentItem.originalScheduledTime}
                  </Text>
                ) : (
                  <Text style={styles.metaText}>Flexible timing</Text>
                )}
                {currentItem.originalEstimatedDurationMinutes ? (
                  <Text style={styles.metaText}>
                    {currentItem.originalEstimatedDurationMinutes} min estimate
                  </Text>
                ) : null}
              </View>

              {actionMode ? (
                <ActionForm
                  breakdownTitles={breakdownTitles}
                  delegateNote={delegateNote}
                  isSaving={recovery.isSaving}
                  item={currentItem}
                  mode={actionMode}
                  onAddBreakdownTitle={() =>
                    setBreakdownTitles((titles) => [...titles, ""])
                  }
                  onCancel={() => setActionMode(null)}
                  onChangeBreakdownTitle={(index, value) =>
                    setBreakdownTitles((titles) =>
                      titles.map((title, titleIndex) =>
                        titleIndex === index ? value : title
                      )
                    )
                  }
                  onChangeDelegateNote={setDelegateNote}
                  onChangeRescheduledDate={setRescheduledDate}
                  onChangeRescheduledTime={setRescheduledTime}
                  onConfirm={() => {
                    if (actionMode === "reschedule") {
                      return runAndClose(() =>
                        recovery.rescheduleTask(
                          currentItem.id,
                          rescheduledDate,
                          rescheduledTime
                        )
                      );
                    }

                    if (actionMode === "break_down") {
                      return runAndClose(() =>
                        recovery.breakDownTask(currentItem.id, breakdownTitles)
                      );
                    }

                    if (actionMode === "delegate") {
                      return runAndClose(() =>
                        recovery.delegateTask(currentItem.id, delegateNote)
                      );
                    }

                    return runAndClose(() => recovery.removeTask(currentItem.id));
                  }}
                  rescheduledDate={rescheduledDate}
                  rescheduledTime={rescheduledTime}
                />
              ) : (
                <View style={styles.actionList}>
                  <RecoveryButton
                    disabled={recovery.isSaving}
                    label="Keep, but unschedule"
                    onPress={() => runAndClose(() => recovery.keepTask(currentItem.id))}
                  />
                  <RecoveryButton
                    disabled={recovery.isSaving}
                    label="Reschedule"
                    onPress={() => setActionMode("reschedule")}
                  />
                  <RecoveryButton
                    disabled={recovery.isSaving}
                    label="Break into smaller tasks"
                    onPress={() => setActionMode("break_down")}
                  />
                  <RecoveryButton
                    disabled={recovery.isSaving}
                    label="Delegate"
                    onPress={() => setActionMode("delegate")}
                  />
                  <RecoveryButton
                    disabled={recovery.isSaving}
                    label="Remove from active tasks"
                    onPress={() => setActionMode("remove")}
                  />
                  <RecoveryButton
                    disabled={recovery.isSaving}
                    label="Decide later"
                    onPress={() => runAndClose(() => recovery.skipTask(currentItem.id))}
                    quiet
                  />
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyPanel}>
              <Text style={styles.sectionTitle}>Everything has a next step</Text>
              <Text style={styles.bodyText}>
                Finish when you are ready. Your choices are already saved locally.
              </Text>
            </View>
          )}

          {recovery.session.items.some((item) => item.status === "resolved") ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Decisions so far</Text>
              {recovery.session.items
                .filter((item) => item.status === "resolved")
                .map((item) => (
                  <View key={item.id} style={styles.decisionRow}>
                    <View style={styles.decisionText}>
                      <Text style={styles.decisionTitle}>{item.originalTitle}</Text>
                      <Text style={styles.metaText}>
                        {getRecoveryDecisionLabel(item.decision)}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Change decision for ${item.originalTitle}`}
                      disabled={recovery.isSaving}
                      onPress={() => recovery.reopenItem(item.id)}
                      style={({ pressed }) => [
                        styles.changeButton,
                        pressed && styles.pressed
                      ]}
                    >
                      <Text style={styles.changeButtonText}>Change</Text>
                    </Pressable>
                  </View>
                ))}
            </View>
          ) : null}

          {recovery.session.items.every((item) => item.status === "resolved") ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Finish Recovery Mode"
              disabled={recovery.isSaving}
              onPress={recovery.completeSession}
              style={({ pressed }) => [
                styles.finishButton,
                pressed && styles.pressed,
                recovery.isSaving && styles.disabled
              ]}
            >
              <Text style={styles.finishButtonText}>
                {recovery.isSaving ? "Saving..." : "Finish Recovery Mode"}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function StartPanel({
  sourceDate,
  latestDate,
  isSaving,
  onChangeDate,
  onStart
}: {
  sourceDate: string;
  latestDate: RecoverySession["sourceDate"] | null;
  isSaving: boolean;
  onChangeDate(value: string): void;
  onStart(): void;
}) {
  return (
    <View style={styles.startPanel}>
      <Text style={styles.sectionTitle}>Choose the day to review</Text>
      <Text style={styles.bodyText}>
        Only unfinished tasks scheduled for this day will be included.
      </Text>
      <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
      <TextInput
        accessibilityLabel="Recovery date"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeDate}
        placeholder="YYYY-MM-DD"
        style={styles.input}
        value={sourceDate}
      />
      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={onStart}
        style={({ pressed }) => [
          styles.finishButton,
          pressed && styles.pressed,
          isSaving && styles.disabled
        ]}
      >
        <Text style={styles.finishButtonText}>
          {isSaving ? "Starting..." : "Start Recovery Mode"}
        </Text>
      </Pressable>
      {latestDate ? (
        <Text style={styles.mutedText}>
          Last completed review: {formatLocalDateForDisplay(latestDate)}
        </Text>
      ) : null}
      <Link href="/" asChild>
        <Pressable accessibilityRole="link" style={styles.todayLink}>
          <Text style={styles.todayLinkText}>Return to Today</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function ProgressPanel({
  session
}: {
  session: NonNullable<ReturnType<typeof useRecoverySession>["session"]>;
}) {
  const resolvedCount = getResolvedRecoveryItemCount(session);

  return (
    <View style={styles.progressPanel} accessibilityRole="summary">
      <Text style={styles.progressText}>
        {resolvedCount} of {session.items.length} tasks decided
      </Text>
      <Text style={styles.mutedText}>
        Reviewing {formatLocalDateForDisplay(session.sourceDate)}
      </Text>
    </View>
  );
}

function RecoveryButton({
  label,
  onPress,
  disabled,
  quiet = false
}: {
  label: string;
  onPress(): void;
  disabled: boolean;
  quiet?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        quiet && styles.quietButton,
        disabled && styles.disabled,
        pressed && styles.pressed
      ]}
    >
      <Text style={[styles.actionButtonText, quiet && styles.quietButtonText]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ActionForm({
  mode,
  item,
  rescheduledDate,
  rescheduledTime,
  breakdownTitles,
  delegateNote,
  isSaving,
  onChangeRescheduledDate,
  onChangeRescheduledTime,
  onChangeBreakdownTitle,
  onAddBreakdownTitle,
  onChangeDelegateNote,
  onConfirm,
  onCancel
}: {
  mode: Exclude<ActionMode, null>;
  item: RecoveryItem;
  rescheduledDate: string;
  rescheduledTime: string;
  breakdownTitles: string[];
  delegateNote: string;
  isSaving: boolean;
  onChangeRescheduledDate(value: string): void;
  onChangeRescheduledTime(value: string): void;
  onChangeBreakdownTitle(index: number, value: string): void;
  onAddBreakdownTitle(): void;
  onChangeDelegateNote(value: string): void;
  onConfirm(): void;
  onCancel(): void;
}) {
  return (
    <View style={styles.formPanel}>
      {mode === "reschedule" ? (
        <>
          <Text style={styles.formTitle}>Choose a new time</Text>
          <Text style={styles.bodyText}>
            The task keeps its history and moves only after you save.
          </Text>
          <Text style={styles.label}>New date (YYYY-MM-DD)</Text>
          <TextInput
            accessibilityLabel="New scheduled date"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={onChangeRescheduledDate}
            placeholder="YYYY-MM-DD"
            style={styles.input}
            value={rescheduledDate}
          />
          <Text style={styles.label}>Time (optional, HH:MM)</Text>
          <TextInput
            accessibilityLabel="New scheduled time"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={onChangeRescheduledTime}
            placeholder="HH:MM"
            style={styles.input}
            value={rescheduledTime}
          />
        </>
      ) : null}

      {mode === "break_down" ? (
        <>
          <Text style={styles.formTitle}>Name smaller tasks</Text>
          <Text style={styles.bodyText}>
            Add at least two concrete pieces. They will start unscheduled.
          </Text>
          {breakdownTitles.map((title, index) => (
            <View key={index} style={styles.fieldGroup}>
              <Text style={styles.label}>Smaller task {index + 1}</Text>
              <TextInput
                accessibilityLabel={`Smaller task ${index + 1}`}
                onChangeText={(value) => onChangeBreakdownTitle(index, value)}
                placeholder="A clear next step"
                style={styles.input}
                value={title}
              />
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={onAddBreakdownTitle}
            style={styles.changeButton}
          >
            <Text style={styles.changeButtonText}>Add another smaller task</Text>
          </Pressable>
        </>
      ) : null}

      {mode === "delegate" ? (
        <>
          <Text style={styles.formTitle}>Delegate this task</Text>
          <Text style={styles.bodyText}>
            Add an optional reminder about who or what happens next.
          </Text>
          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            accessibilityLabel="Delegation note"
            multiline
            onChangeText={onChangeDelegateNote}
            placeholder="For example: Ask Sam on Friday"
            style={[styles.input, styles.multilineInput]}
            value={delegateNote}
          />
        </>
      ) : null}

      {mode === "remove" ? (
        <>
          <Text style={styles.formTitle}>Remove from active tasks?</Text>
          <Text style={styles.bodyText}>
            “{item.originalTitle}” will leave active task lists, while its history and
            this decision remain stored.
          </Text>
        </>
      ) : null}

      <View style={styles.formActions}>
        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={onConfirm}
          style={({ pressed }) => [
            styles.confirmButton,
            pressed && styles.pressed,
            isSaving && styles.disabled
          ]}
        >
          <Text style={styles.confirmButtonText}>
            {isSaving ? "Saving..." : getConfirmLabel(mode)}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={onCancel}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

function getConfirmLabel(mode: Exclude<ActionMode, null>): string {
  switch (mode) {
    case "reschedule":
      return "Save new time";
    case "break_down":
      return "Create smaller tasks";
    case "delegate":
      return "Mark delegated";
    case "remove":
      return "Confirm removal";
  }
}

function normalizeSourceDate(value: string | undefined): string {
  return (value && normalizeLocalDateInput(value)) || getLocalDateString();
}

const styles = StyleSheet.create({
  header: {
    gap: 6,
    marginBottom: 18
  },
  kicker: {
    color: "#59665e",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  title: {
    color: "#2f2d2a",
    fontSize: 28,
    fontWeight: "800"
  },
  intro: {
    color: "#4f4b45",
    fontSize: 16,
    lineHeight: 23
  },
  fixedNotice: {
    backgroundColor: "#eef2ed",
    borderColor: "#ced8d0",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 18,
    padding: 14
  },
  fixedNoticeText: {
    color: "#405149",
    fontSize: 14,
    lineHeight: 20
  },
  centered: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 30
  },
  mutedText: {
    color: "#68645e",
    fontSize: 14,
    lineHeight: 20
  },
  startPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d9d4ca",
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
    padding: 18
  },
  progressPanel: {
    alignItems: "center",
    backgroundColor: "#eef2ed",
    borderRadius: 8,
    gap: 4,
    marginBottom: 14,
    padding: 14
  },
  progressText: {
    color: "#263f38",
    fontSize: 16,
    fontWeight: "800"
  },
  reviewCard: {
    backgroundColor: "#ffffff",
    borderColor: "#d9d4ca",
    borderRadius: 10,
    borderWidth: 1,
    gap: 14,
    padding: 18
  },
  cardKicker: {
    color: "#59665e",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  taskTitle: {
    color: "#2f2d2a",
    fontSize: 23,
    fontWeight: "800",
    lineHeight: 29
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metaText: {
    color: "#68645e",
    fontSize: 13,
    lineHeight: 19
  },
  actionList: {
    gap: 10
  },
  actionButton: {
    alignItems: "center",
    borderColor: "#2f5d62",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16
  },
  actionButtonText: {
    color: "#2f5d62",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center"
  },
  quietButton: {
    borderColor: "#aaa39a"
  },
  quietButtonText: {
    color: "#5e5952"
  },
  formPanel: {
    backgroundColor: "#f7f5f0",
    borderRadius: 8,
    gap: 10,
    padding: 14
  },
  formTitle: {
    color: "#2f2d2a",
    fontSize: 19,
    fontWeight: "800"
  },
  bodyText: {
    color: "#514d47",
    fontSize: 15,
    lineHeight: 22
  },
  fieldGroup: {
    gap: 7
  },
  label: {
    color: "#3f3b36",
    fontSize: 14,
    fontWeight: "700"
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#aaa39a",
    borderRadius: 8,
    borderWidth: 1,
    color: "#2f2d2a",
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  multilineInput: {
    minHeight: 92,
    textAlignVertical: "top"
  },
  formActions: {
    gap: 10,
    paddingTop: 6
  },
  confirmButton: {
    alignItems: "center",
    backgroundColor: "#2f5d62",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16
  },
  confirmButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800"
  },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46
  },
  cancelButtonText: {
    color: "#2f5d62",
    fontSize: 15,
    fontWeight: "800"
  },
  section: {
    gap: 10,
    marginTop: 22
  },
  sectionTitle: {
    color: "#2f2d2a",
    fontSize: 19,
    fontWeight: "800"
  },
  decisionRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d9d4ca",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14
  },
  decisionText: {
    flex: 1,
    gap: 4
  },
  decisionTitle: {
    color: "#2f2d2a",
    fontSize: 15,
    fontWeight: "700"
  },
  changeButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "#2f5d62",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12
  },
  changeButtonText: {
    color: "#2f5d62",
    fontSize: 14,
    fontWeight: "800"
  },
  emptyPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d9d4ca",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 18
  },
  finishButton: {
    alignItems: "center",
    backgroundColor: "#2f5d62",
    borderRadius: 8,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 50,
    paddingHorizontal: 18
  },
  finishButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800"
  },
  todayLink: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44
  },
  todayLinkText: {
    color: "#24565c",
    fontSize: 15,
    fontWeight: "800"
  },
  pressed: {
    opacity: 0.72
  },
  disabled: {
    opacity: 0.65
  }
});

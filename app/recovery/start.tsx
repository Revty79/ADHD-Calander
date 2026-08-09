import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ErrorNotice } from "../../src/components/ErrorNotice";
import { Screen } from "../../src/components/Screen";
import { useRecoveryRepository } from "../../src/database/DatabaseProvider";
import { applyRecoveryEntryDecision } from "../../src/features/recovery/recoveryEntry";
import { RecoverySession } from "../../src/types/recovery";
import { formatLocalDateForDisplay, getLocalDateString } from "../../src/utils/dates";

export default function StartRecoveryScreen() {
  const router = useRouter();
  const repository = useRecoveryRepository();
  const [activeSession, setActiveSession] = useState<RecoverySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const today = getLocalDateString();

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setActiveSession(await repository.getActiveSession());
    } catch (error) {
      console.error("Failed to prepare Recovery Mode", error);
      setErrorMessage("Recovery Mode could not be prepared. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function confirmEntry() {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await applyRecoveryEntryDecision("confirm", repository, today);
      router.replace("/(tabs)/recovery");
    } catch (error) {
      console.error("Failed to enter Recovery Mode", error);
      setErrorMessage("Recovery Mode could not be started. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function cancelEntry() {
    await applyRecoveryEntryDecision("cancel", repository, today);
    router.back();
  }

  return (
    <Screen>
      <View style={styles.panel}>
        <Text style={styles.kicker}>A safe reset point</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Plans changed?
        </Text>
        <Text style={styles.body}>
          Review unfinished work one task at a time. Nothing will be moved, completed, or
          removed until you choose what happens next.
        </Text>

        {isLoading ? (
          <ActivityIndicator accessibilityLabel="Checking for active Recovery Mode" />
        ) : null}

        {errorMessage ? <ErrorNotice message={errorMessage} onRetry={refresh} /> : null}

        {!isLoading && activeSession ? (
          <Text style={styles.notice}>
            A Recovery review for {formatLocalDateForDisplay(activeSession.sourceDate)}
            is already active. You can continue where you left off.
          </Text>
        ) : !isLoading ? (
          <Text style={styles.notice}>
            Start a review of unfinished tasks planned for{" "}
            {formatLocalDateForDisplay(today)}.
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityLabel={
              activeSession ? "Resume Recovery Mode" : "Start Recovery Mode"
            }
            accessibilityRole="button"
            disabled={isLoading || isSaving}
            onPress={confirmEntry}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving
                ? "Opening..."
                : activeSession
                  ? "Resume Recovery"
                  : "Start Recovery"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Cancel without changing tasks"
            accessibilityRole="button"
            disabled={isSaving}
            onPress={cancelEntry}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.cancelButtonText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d4dcd6",
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
    maxWidth: 560,
    padding: 22,
    width: "100%"
  },
  kicker: {
    color: "#59665e",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: { color: "#292724", fontSize: 30, fontWeight: "800" },
  body: { color: "#4a4742", fontSize: 16, lineHeight: 24 },
  notice: {
    backgroundColor: "#eef2ed",
    borderRadius: 8,
    color: "#405149",
    fontSize: 14,
    lineHeight: 21,
    padding: 14
  },
  actions: { gap: 10 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2f5d62",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16
  },
  primaryButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16
  },
  cancelButtonText: { color: "#4f5c54", fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.72 }
});

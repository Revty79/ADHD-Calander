import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { ErrorNotice } from "../../../src/components/ErrorNotice";
import { useCalendarEventRepository } from "../../../src/database/DatabaseProvider";
import { EventEditorForm } from "../../../src/features/calendar/components/EventEditorForm";
import {
  CalendarEvent,
  CalendarEventEditScope,
  CalendarEventOccurrence,
  CreateCalendarEventInput
} from "../../../src/types/calendarEvent";

export default function EditEventScreen() {
  const params = useLocalSearchParams<{ id: string; originalDate?: string }>();
  const router = useRouter();
  const repository = useCalendarEventRepository();
  const [series, setSeries] = useState<CalendarEvent | null>(null);
  const [occurrence, setOccurrence] = useState<CalendarEventOccurrence | null>(null);
  const [scope, setScope] = useState<CalendarEventEditScope | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const loadedSeries = await repository.getEventSeries(params.id);
        const loadedOccurrence = await repository.getEventOccurrence(
          params.id,
          params.originalDate ?? loadedSeries.date
        );
        if (active) {
          setSeries(loadedSeries);
          setOccurrence(loadedOccurrence);
          setScope(loadedSeries.recurrence ? null : "all");
        }
      } catch {
        if (active) setErrorMessage("The event could not be loaded. Please try again.");
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [params.id, params.originalDate, repository]);

  if (errorMessage)
    return (
      <View style={styles.centered}>
        <ErrorNotice message={errorMessage} onRetry={() => router.back()} />
      </View>
    );
  if (!series || !occurrence)
    return (
      <View style={styles.centered}>
        <ActivityIndicator accessibilityLabel="Loading event" />
        <Text style={styles.muted}>Loading event...</Text>
      </View>
    );

  const activeSeries = series;
  const activeOccurrence = occurrence;

  if (activeSeries.recurrence && !scope) {
    return (
      <View style={styles.scopePage}>
        <Text accessibilityRole="header" style={styles.title}>
          Which events should change?
        </Text>
        <Text style={styles.muted}>
          Choose the part of this recurring series you want to edit or remove.
        </Text>
        <View style={styles.scopeChoices}>
          {scopeOptions.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => setScope(option.value)}
              style={({ pressed }) => [styles.scopeButton, pressed && styles.pressed]}
            >
              <Text style={styles.scopeButtonTitle}>{option.label}</Text>
              <Text style={styles.scopeButtonText}>{option.description}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  async function save(input: CreateCalendarEventInput) {
    const result = await repository.updateEvent(
      activeSeries.id,
      activeOccurrence.originalDate,
      scope!,
      input
    );
    router.replace({ pathname: "/(tabs)/calendar", params: { date: result.date } });
  }

  async function remove() {
    const confirmed = await confirmRemoval(scope!);
    if (!confirmed) return;
    await repository.deleteEvent(activeSeries.id, activeOccurrence.originalDate, scope!);
    router.replace({
      pathname: "/(tabs)/calendar",
      params: { date: activeOccurrence.date }
    });
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Edit event
        </Text>
        {activeSeries.recurrence ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setScope(null)}
            style={({ pressed }) => [styles.changeScope, pressed && styles.pressed]}
          >
            <Text style={styles.changeScopeText}>Change edit scope</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.scopeSummary}>
        {activeSeries.recurrence ? scopeLabels[scope!] : "Single event"}
      </Text>
      <EventEditorForm
        allowRecurrenceEdit={scope !== "this"}
        initialDate={activeOccurrence.date}
        initialEvent={activeOccurrence}
        initialRecurrence={activeSeries.recurrence}
        onDelete={remove}
        onSubmit={save}
        submitLabel="Save changes"
      />
    </ScrollView>
  );
}

const scopeOptions: {
  value: CalendarEventEditScope;
  label: string;
  description: string;
}[] = [
  { value: "this", label: "This event", description: "Only this occurrence changes." },
  {
    value: "future",
    label: "This and future events",
    description: "Past occurrences stay factual; a new future series begins here."
  },
  {
    value: "all",
    label: "All events",
    description: "Update the recurring series as a whole."
  }
];
const scopeLabels: Record<CalendarEventEditScope, string> = {
  this: "Changing this occurrence only",
  future: "Changing this and future occurrences",
  all: "Changing the whole series"
};

function confirmRemoval(scope: CalendarEventEditScope): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      "Remove event?",
      scopeLabels[scope],
      [
        { text: "Keep event", style: "cancel", onPress: () => resolve(false) },
        { text: "Remove", style: "destructive", onPress: () => resolve(true) }
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    )
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    flex: 1,
    gap: 10,
    justifyContent: "center",
    padding: 24
  },
  content: { backgroundColor: "#f8f7f3", gap: 12, padding: 20, paddingBottom: 36 },
  scopePage: { backgroundColor: "#f8f7f3", flex: 1, gap: 14, padding: 22 },
  title: { color: "#2f2d2a", fontSize: 24, fontWeight: "800" },
  muted: { color: "#68645e", fontSize: 15, lineHeight: 22 },
  scopeChoices: { gap: 10, marginTop: 8 },
  scopeButton: {
    backgroundColor: "#fff",
    borderColor: "#cfc8bd",
    borderRadius: 9,
    borderWidth: 1,
    gap: 4,
    minHeight: 64,
    padding: 15
  },
  scopeButtonTitle: { color: "#2f2d2a", fontSize: 16, fontWeight: "800" },
  scopeButtonText: { color: "#5c625e", fontSize: 13, lineHeight: 19 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  changeScope: { justifyContent: "center", minHeight: 44, paddingHorizontal: 6 },
  changeScopeText: { color: "#24565c", fontSize: 14, fontWeight: "700" },
  scopeSummary: { color: "#53625b", fontSize: 14, fontWeight: "700", marginBottom: 6 },
  pressed: { opacity: 0.7 }
});

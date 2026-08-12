import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";

import { useCalendarEventRepository } from "../../src/database/DatabaseProvider";
import { EventEditorForm } from "../../src/features/calendar/components/EventEditorForm";
import { getLocalDateString, normalizeLocalDateInput } from "../../src/utils/dates";

export default function NewEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const repository = useCalendarEventRepository();
  const initialDate = useMemo(
    () => normalizeLocalDateInput(params.date ?? "") ?? getLocalDateString(),
    [params.date]
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={styles.keyboardView}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        style={styles.scrollView}
      >
        <EventEditorForm
          initialDate={initialDate}
          onSubmit={async (input) => {
            const event = await repository.createEvent(input);
            router.replace({
              pathname: "/(tabs)/calendar",
              params: { date: event.date }
            });
          }}
          submitLabel="Save event"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: { backgroundColor: "#f8f7f3", flex: 1 },
  scrollView: { backgroundColor: "#f8f7f3" },
  content: { padding: 20, paddingBottom: 36 }
});

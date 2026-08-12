import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";

import { useCalendarEventRepository } from "../../src/database/DatabaseProvider";
import { EventEditorForm } from "../../src/features/calendar/components/EventEditorForm";
import { getLocalDateString, normalizeLocalDateInput } from "../../src/utils/dates";

export default function WebNewEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const repository = useCalendarEventRepository();
  const initialDate = useMemo(
    () => normalizeLocalDateInput(params.date ?? "") ?? getLocalDateString(),
    [params.date]
  );

  return (
    <main className="web-form-shell">
      <div className="web-form-page">
        <Link
          className="web-back-link"
          href={{ pathname: "/calendar", params: { date: initialDate } }}
        >
          Back to Calendar
        </Link>
        <header className="web-form-header">
          <p className="web-eyebrow">Fixed commitment</p>
          <h1>New event</h1>
          <p>Events stay fixed. Use a task for work that may remain flexible.</p>
        </header>
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
      </div>
    </main>
  );
}

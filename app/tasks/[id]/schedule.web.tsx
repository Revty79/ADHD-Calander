import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import {
  practicalDurationOptions,
  useSchedulingSuggestions
} from "../../../src/features/scheduling/hooks/useSchedulingSuggestions";
import { SchedulingSuggestion } from "../../../src/features/scheduling/types";
import { formatLocalDateForDisplay } from "../../../src/utils/dates";

export default function WebScheduleTaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const taskId = typeof params.id === "string" ? params.id : "";
  const scheduling = useSchedulingSuggestions(taskId);
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<SchedulingSuggestion | null>(null);
  const selectedDuration =
    scheduling.durationOverride ?? scheduling.result?.durationMinutes ?? null;

  function chooseDuration(durationMinutes: number) {
    setSelectedSuggestion(null);
    scheduling.chooseDuration(durationMinutes);
  }

  async function confirmSchedule() {
    if (!selectedSuggestion) {
      return;
    }

    const task = await scheduling.acceptSuggestion(selectedSuggestion);

    if (task?.scheduledDate) {
      router.replace({
        pathname: "/(tabs)/calendar",
        params: { date: task.scheduledDate }
      });
    }
  }

  return (
    <main className="web-form-shell">
      <div className="web-scheduling-page">
        <Link className="web-back-link" href="/tasks">
          Back to Tasks
        </Link>

        <header className="web-form-header">
          <p className="web-eyebrow">Rule-based scheduling</p>
          <h1>Help me schedule</h1>
          <p>
            Review a few conservative openings. Nothing changes until you confirm one.
          </p>
        </header>

        {scheduling.isLoading && !scheduling.result ? (
          <p aria-live="polite" className="web-loading-state" role="status">
            Looking for comfortable openings...
          </p>
        ) : null}

        {scheduling.errorMessage ? (
          <div className="web-error-notice" role="alert">
            <p>{scheduling.errorMessage}</p>
            <button
              className="web-secondary-button"
              onClick={scheduling.refresh}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        {scheduling.result ? (
          <>
            <section className="web-scheduling-task" aria-labelledby="task-title">
              <div>
                <p className="web-eyebrow">Flexible task</p>
                <h2 id="task-title">{scheduling.result.task.title}</h2>
                {scheduling.result.task.description ? (
                  <p>{scheduling.result.task.description}</p>
                ) : null}
              </div>
              <dl>
                {scheduling.result.task.deadlineDate ? (
                  <div>
                    <dt>Deadline</dt>
                    <dd>
                      {formatLocalDateForDisplay(scheduling.result.task.deadlineDate)}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Planning hours</dt>
                  <dd>
                    {formatTime(scheduling.result.preferences.planningDayStart)}–
                    {formatTime(scheduling.result.preferences.planningDayEnd)}
                  </dd>
                </div>
                <div>
                  <dt>Fixed-event buffer</dt>
                  <dd>{scheduling.result.preferences.transitionBufferMinutes} min</dd>
                </div>
              </dl>
            </section>

            <section className="web-scheduling-section" aria-labelledby="duration-title">
              <h2 id="duration-title">How long might this take?</h2>
              <p>
                Choose a practical estimate. You can try another estimate without changing
                the task yet.
              </p>
              <div className="web-duration-options">
                {practicalDurationOptions.map((duration) => (
                  <button
                    aria-pressed={selectedDuration === duration}
                    className={
                      selectedDuration === duration
                        ? "web-duration-button is-selected"
                        : "web-duration-button"
                    }
                    key={duration}
                    onClick={() => chooseDuration(duration)}
                    type="button"
                  >
                    {formatDuration(duration)}
                  </button>
                ))}
              </div>
            </section>

            {scheduling.result.status === "needs_duration" ? (
              <section className="web-scheduling-message" aria-live="polite">
                <h2>Add an estimated duration</h2>
                <p>
                  Choose an estimate so the scheduler can look for a time that fits fully.
                </p>
              </section>
            ) : null}

            {scheduling.result.status === "no_windows" ? (
              <section className="web-scheduling-message" aria-live="polite">
                <h2>No comfortable opening found</h2>
                <p>
                  I couldn&apos;t find an opening within these planning rules through{" "}
                  {formatLocalDateForDisplay(scheduling.result.searchedThrough)}. The task
                  is still unscheduled.
                </p>
                <div className="web-scheduling-message-actions">
                  {scheduling.horizonDays < 14 ? (
                    <button
                      className="web-secondary-button"
                      onClick={() => {
                        setSelectedSuggestion(null);
                        scheduling.lookFartherAhead();
                      }}
                      type="button"
                    >
                      Look 14 days ahead
                    </button>
                  ) : null}
                  <p>You can also try a shorter estimate or leave it unscheduled.</p>
                </div>
              </section>
            ) : null}

            {scheduling.result.status === "ready" ? (
              <section className="web-scheduling-section" aria-labelledby="times-title">
                <h2 id="times-title">Suggested times</h2>
                <p>
                  These options fit the full estimate without overlapping fixed events or
                  timed tasks.
                </p>
                <div className="web-suggestion-grid">
                  {scheduling.result.suggestions.map((suggestion) => {
                    const isSelected = sameSuggestion(selectedSuggestion, suggestion);

                    return (
                      <button
                        aria-label={`Suggested time: ${formatLocalDateForDisplay(
                          suggestion.date
                        )}, ${formatTime(suggestion.startTime)} to ${formatTime(
                          suggestion.endTime
                        )}. ${suggestion.explanation}`}
                        aria-pressed={isSelected}
                        className={
                          isSelected
                            ? "web-suggestion-card is-selected"
                            : "web-suggestion-card"
                        }
                        key={`${suggestion.date}-${suggestion.startTime}`}
                        onClick={() => setSelectedSuggestion(suggestion)}
                        type="button"
                      >
                        <span className="web-suggestion-date">
                          {formatLocalDateForDisplay(suggestion.date)}
                        </span>
                        <strong>
                          {formatTime(suggestion.startTime)}–
                          {formatTime(suggestion.endTime)}
                        </strong>
                        <span>{suggestion.explanation}</span>
                        <b>{isSelected ? "Selected" : "Choose this time"}</b>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {selectedSuggestion ? (
              <section className="web-scheduling-confirm" aria-live="polite">
                <h2>Confirm this placement?</h2>
                <p>
                  {formatLocalDateForDisplay(selectedSuggestion.date)},{" "}
                  {formatTime(selectedSuggestion.startTime)}–
                  {formatTime(selectedSuggestion.endTime)}
                </p>
                <p>
                  This updates the existing task. It does not create another task or
                  event.
                </p>
                <div className="web-form-actions">
                  <button
                    className="web-primary-button"
                    disabled={scheduling.isAccepting}
                    onClick={confirmSchedule}
                    type="button"
                  >
                    {scheduling.isAccepting ? "Scheduling..." : "Confirm schedule"}
                  </button>
                  <button
                    className="web-secondary-button"
                    disabled={scheduling.isAccepting}
                    onClick={() => setSelectedSuggestion(null)}
                    type="button"
                  >
                    Keep looking
                  </button>
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        <Link className="web-cancel-link web-scheduling-leave" href="/tasks">
          Leave task unscheduled
        </Link>
      </div>
    </main>
  );
}

function sameSuggestion(
  first: SchedulingSuggestion | null,
  second: SchedulingSuggestion
): boolean {
  return (
    first?.date === second.date &&
    first.startTime === second.startTime &&
    first.endTime === second.endTime
  );
}

function formatDuration(minutes: number): string {
  return minutes === 120 ? "2 hr" : `${minutes} min`;
}

function formatTime(value: string): string {
  const [hourValue, minuteValue] = value.split(":").map(Number);
  const hour = hourValue ?? 0;
  const minute = minuteValue ?? 0;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

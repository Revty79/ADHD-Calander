import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import {
  practicalDurationOptions,
  useSchedulingSuggestions
} from "../../../src/features/scheduling/hooks/useSchedulingSuggestions";
import { SchedulingSuggestion } from "../../../src/features/scheduling/types";
import { getTaskPlanningLabel } from "../../../src/features/tasks/taskPresentation";
import {
  formatLocalDateForDisplay,
  getLocalDateString,
  normalizeLocalDateInput
} from "../../../src/utils/dates";

export default function WebScheduleTaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const taskId = typeof params.id === "string" ? params.id : "";
  const scheduling = useSchedulingSuggestions(taskId);
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<SchedulingSuggestion | null>(null);
  const [today] = useState(() => getLocalDateString(new Date()));
  const [specificDateOverride, setSpecificDate] = useState<string | null>(null);
  const [specificTimeOverride, setSpecificTime] = useState<string | null>(null);
  const [isReviewingSpecificTime, setIsReviewingSpecificTime] = useState(false);
  const selectedDuration =
    scheduling.durationOverride ?? scheduling.result?.durationMinutes ?? null;
  const specificDate =
    specificDateOverride ?? scheduling.result?.task.scheduledDate ?? today;
  const specificTime =
    specificTimeOverride ?? scheduling.result?.task.scheduledTime ?? "";

  function chooseDuration(durationMinutes: number) {
    setSelectedSuggestion(null);
    setIsReviewingSpecificTime(false);
    scheduling.chooseDuration(durationMinutes);
  }

  async function confirmSchedule() {
    if (!selectedSuggestion) {
      return;
    }

    const task = await scheduling.acceptSuggestion(selectedSuggestion);

    returnToTask(task?.id);
  }

  async function confirmSpecificTime() {
    if (!specificDate || !specificTime) {
      return;
    }

    const task = await scheduling.scheduleSpecificTime({
      scheduledDate: specificDate,
      scheduledTime: specificTime,
      ...(selectedDuration === null ? {} : { estimatedDurationMinutes: selectedDuration })
    });

    returnToTask(task?.id);
  }

  function returnToTask(id: string | undefined) {
    if (id) {
      router.replace({
        pathname: "/tasks/[id]",
        params: { id }
      });
    }
  }

  return (
    <main className="web-form-shell">
      <div className="web-scheduling-page">
        <Link
          className="web-back-link"
          href={{ pathname: "/tasks/[id]", params: { id: taskId } }}
        >
          Back to task
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
                <p className="web-eyebrow">
                  {getTaskPlanningLabel(scheduling.result.task)} task
                </p>
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

            <section
              className="web-scheduling-specific"
              aria-labelledby="specific-time-title"
            >
              <div>
                <h2 id="specific-time-title">Choose a specific time</h2>
                <p>
                  Already know when you want to do it? Enter the exact date and time
                  instead of using a suggestion. Nothing changes until you confirm.
                </p>
              </div>
              <div className="web-scheduling-specific-fields">
                <label htmlFor="specific-task-date">
                  Date
                  <input
                    id="specific-task-date"
                    onChange={(event) => {
                      setSpecificDate(event.currentTarget.value);
                      setIsReviewingSpecificTime(false);
                    }}
                    type="date"
                    value={specificDate}
                  />
                </label>
                <label htmlFor="specific-task-time">
                  Start time
                  <input
                    id="specific-task-time"
                    onChange={(event) => {
                      setSpecificTime(event.currentTarget.value);
                      setIsReviewingSpecificTime(false);
                    }}
                    type="time"
                    value={specificTime}
                  />
                </label>
              </div>
              {scheduling.result.task.reminderOffsets.length > 0 ? (
                <p>
                  The task&apos;s{" "}
                  {formatReminderCount(scheduling.result.task.reminderOffsets.length)}{" "}
                  will move with the confirmed time. Android schedules only future trigger
                  times.
                </p>
              ) : null}
              <button
                className="web-secondary-button"
                disabled={!specificDate || !specificTime}
                onClick={() => {
                  setSelectedSuggestion(null);
                  setIsReviewingSpecificTime(true);
                }}
                type="button"
              >
                Review this exact time
              </button>
            </section>

            {isReviewingSpecificTime && specificDate && specificTime ? (
              <section className="web-scheduling-confirm" aria-live="polite">
                <h2>Confirm this exact time?</h2>
                <p>
                  {formatSpecificDate(specificDate)}, {formatTime(specificTime)}
                </p>
                <p>
                  This updates the existing task. It does not create another task or
                  event.
                </p>
                <div className="web-form-actions">
                  <button
                    className="web-primary-button"
                    disabled={scheduling.isAccepting}
                    onClick={confirmSpecificTime}
                    type="button"
                  >
                    {scheduling.isAccepting ? "Scheduling..." : "Confirm exact time"}
                  </button>
                  <button
                    className="web-secondary-button"
                    disabled={scheduling.isAccepting}
                    onClick={() => setIsReviewingSpecificTime(false)}
                    type="button"
                  >
                    Keep editing
                  </button>
                </div>
              </section>
            ) : null}

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
                        onClick={() => {
                          setIsReviewingSpecificTime(false);
                          setSelectedSuggestion(suggestion);
                        }}
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

        <Link
          className="web-cancel-link web-scheduling-leave"
          href={{ pathname: "/tasks/[id]", params: { id: taskId } }}
        >
          Back to task
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

function formatReminderCount(count: number): string {
  return count === 1 ? "1 saved reminder" : `${count} saved reminders`;
}

function formatSpecificDate(value: string): string {
  const normalized = normalizeLocalDateInput(value);

  return normalized ? formatLocalDateForDisplay(normalized) : value;
}

import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { FormEvent, useCallback, useMemo, useState } from "react";

import { addLocalDays } from "../../src/features/calendar/calendarDates";
import { useDailyRecap } from "../../src/features/recap/hooks/useDailyRecap";
import {
  formatCompletionTime,
  formatEventTime,
  formatRecoveryDecision,
  getOpenReasonLabel
} from "../../src/features/recap/recapPresentation";
import { recapRecoveryDecisionTypes } from "../../src/types/recap";
import { LocalDateString } from "../../src/types/dateTime";
import {
  formatLocalDateForDisplay,
  getLocalDateString,
  normalizeLocalDateInput
} from "../../src/utils/dates";

export default function WebRecapScreen() {
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const today = useMemo(() => getLocalDateString(), []);
  const routeDate = getRouteDate(params.date, today);

  return <WebRecapContent initialDate={routeDate} key={routeDate} today={today} />;
}

function WebRecapContent({
  initialDate,
  today
}: {
  initialDate: LocalDateString;
  today: LocalDateString;
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [dateInput, setDateInput] = useState<string>(initialDate);
  const [dateError, setDateError] = useState<string | null>(null);
  const { recap, isLoading, errorMessage, refresh } = useDailyRecap(selectedDate);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const chooseDate = useCallback(
    (date: string) => {
      const normalizedDate = normalizeLocalDateInput(date);

      if (!normalizedDate) {
        setDateError("Use a valid date.");
        return;
      }

      if (normalizedDate > today) {
        setDateError("Choose today or an earlier date.");
        return;
      }

      setDateError(null);
      setSelectedDate(normalizedDate);
      setDateInput(normalizedDate);
    },
    [today]
  );

  const submitDate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    chooseDate(dateInput);
  };
  const nextDate = addLocalDays(selectedDate, 1);
  const hasTaskActivity =
    (recap?.accomplishedTasks.length ?? 0) +
      (recap?.stillOpenTasks.length ?? 0) +
      (recap?.recovery.totalDecisionCount ?? 0) +
      (recap?.recovery.waitingDecisionCount ?? 0) >
    0;

  return (
    <div className="web-page web-recap-page">
      <header className="web-page-header web-recap-header">
        <div>
          <p className="web-eyebrow">Daily Recap</p>
          <h1>{formatLocalDateForDisplay(selectedDate)}</h1>
          <p className="web-page-intro">
            A factual look at completed work and how the plan changed.
          </p>
        </div>
        <div className="web-recap-date-controls" aria-label="Choose recap date">
          <div className="web-recap-day-buttons">
            <button
              className="web-secondary-button"
              onClick={() => chooseDate(addLocalDays(selectedDate, -1))}
              type="button"
            >
              Previous day
            </button>
            <button
              className="web-secondary-button"
              disabled={nextDate > today}
              onClick={() => chooseDate(nextDate)}
              type="button"
            >
              Next day
            </button>
          </div>
          <form className="web-recap-date-form" onSubmit={submitDate}>
            <label htmlFor="recap-date">Review another date</label>
            <div>
              <input
                id="recap-date"
                max={today}
                onChange={(event) => setDateInput(event.currentTarget.value)}
                type="date"
                value={dateInput}
              />
              <button className="web-primary-button" type="submit">
                View recap
              </button>
            </div>
            {dateError ? (
              <p className="web-validation-message" role="alert">
                {dateError}
              </p>
            ) : null}
          </form>
        </div>
      </header>

      {isLoading ? (
        <p aria-live="polite" className="web-loading-state" role="status">
          Loading recap...
        </p>
      ) : null}

      {errorMessage ? (
        <div className="web-error-notice" role="alert">
          <p>{errorMessage}</p>
          <button className="web-secondary-button" onClick={refresh} type="button">
            Retry
          </button>
        </div>
      ) : null}

      {!isLoading && !errorMessage && recap ? (
        <div
          className={`web-recap-layout ${
            recap.fixedEvents.length === 0 && recap.recovery.sessionCount === 0
              ? "web-recap-layout-solo"
              : ""
          }`}
        >
          <div className="web-recap-main">
            <section aria-labelledby="accomplished-title" className="web-accomplished">
              <div className="web-section-heading">
                <h2 id="accomplished-title">Accomplished</h2>
                <span className="web-count-badge">
                  {recap.accomplishedTasks.length}{" "}
                  {recap.accomplishedTasks.length === 1 ? "task" : "tasks"}
                </span>
              </div>
              <p className="web-recap-encouragement">{recap.encouragement}</p>
              {recap.completedEstimatedMinutes > 0 ? (
                <p className="web-recap-estimate">
                  {recap.completedEstimatedMinutes} estimated minutes among completed
                  tasks.
                </p>
              ) : null}
              {recap.accomplishedTasks.length === 0 ? (
                <p className="web-recap-empty">
                  {hasTaskActivity
                    ? "No tasks are recorded as completed on this date yet."
                    : "No task activity was recorded for this date."}
                </p>
              ) : (
                <ul className="web-recap-accomplishment-list">
                  {recap.accomplishedTasks.map((task) => (
                    <li key={task.id}>
                      <strong>{task.title}</strong>
                      <span>
                        Completed at {formatCompletionTime(task.completedAt!)}
                        {task.estimatedDurationMinutes
                          ? ` - ${task.estimatedDurationMinutes} min estimate`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {recap.stillOpenTasks.length > 0 ? (
              <section aria-labelledby="still-open-title" className="web-recap-open">
                <h2 id="still-open-title">Still open</h2>
                <p>These remain active. They are shown here as context, not a score.</p>
                <ul>
                  {recap.stillOpenTasks.map(({ task, reason }) => (
                    <li key={task.id}>
                      <strong>{task.title}</strong>
                      <span>{getOpenReasonLabel(reason)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {recap.fixedEvents.length > 0 || recap.recovery.sessionCount > 0 ? (
            <aside className="web-recap-context" aria-label="Calendar and plan context">
              {recap.fixedEvents.length > 0 ? (
                <section
                  aria-labelledby="recap-calendar-title"
                  className="web-recap-panel"
                >
                  <h2 id="recap-calendar-title">On your calendar</h2>
                  <ul className="web-recap-event-list">
                    {recap.fixedEvents.map((event) => (
                      <li key={event.id}>
                        <time dateTime={event.startTime}>{formatEventTime(event)}</time>
                        <span>
                          <strong>{event.title}</strong>
                          <small>Fixed calendar commitment</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {recap.recovery.sessionCount > 0 ? (
                <section
                  aria-labelledby="recap-recovery-title"
                  className="web-recap-panel"
                >
                  <h2 id="recap-recovery-title">
                    {recap.recovery.totalDecisionCount > 0
                      ? "Plan adjusted"
                      : "Recovery review"}
                  </h2>
                  <ul className="web-recap-adjustment-list">
                    {recapRecoveryDecisionTypes.map((decision) => {
                      const count = recap.recovery.decisionCounts[decision];

                      return count > 0 ? (
                        <li key={decision}>{formatRecoveryDecision(decision, count)}</li>
                      ) : null;
                    })}
                    {recap.recovery.waitingDecisionCount > 0 ? (
                      <li className="web-recap-waiting">
                        {recap.recovery.waitingDecisionCount}{" "}
                        {recap.recovery.waitingDecisionCount === 1
                          ? "task is waiting for a decision"
                          : "tasks are waiting for a decision"}
                      </li>
                    ) : null}
                  </ul>
                  {recap.recovery.totalDecisionCount === 0 &&
                  recap.recovery.waitingDecisionCount === 0 ? (
                    <p>A Recovery review was opened with no task decisions needed.</p>
                  ) : null}
                </section>
              ) : null}
            </aside>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function getRouteDate(
  value: string | string[] | undefined,
  today: ReturnType<typeof getLocalDateString>
) {
  const routeValue = Array.isArray(value) ? value[0] : value;
  const normalizedDate = routeValue ? normalizeLocalDateInput(routeValue) : null;

  return normalizedDate && normalizedDate <= today ? normalizedDate : today;
}

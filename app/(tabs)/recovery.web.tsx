import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import { FormEvent, useCallback, useMemo, useState } from "react";

import { useRecoverySession } from "../../src/features/recovery/hooks/useRecoverySession";
import { getRecoveryDecisionLabel } from "../../src/features/recovery/recoveryPresentation";
import {
  getNextRecoveryItem,
  getResolvedRecoveryItemCount,
  RecoveryItem
} from "../../src/types/recovery";
import {
  formatLocalDateForDisplay,
  getLocalDateString,
  normalizeLocalDateInput
} from "../../src/utils/dates";

type ActionMode = "reschedule" | "break_down" | "delegate" | "remove" | null;

export default function WebRecoveryScreen() {
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
    <div className="web-page web-recovery-page">
      <header className="web-page-header">
        <div>
          <p className="web-eyebrow">A smaller next step</p>
          <h1>Recovery Mode</h1>
          <p className="web-page-intro">
            Review unfinished tasks one at a time. Nothing is moved or removed until you
            choose it.
          </p>
        </div>
      </header>

      <p className="web-recovery-notice">
        Fixed appointments stay where they are. Recovery Mode only reviews tasks.
      </p>

      {recovery.isLoading ? (
        <p aria-live="polite" className="web-loading-state" role="status">
          Loading your recovery session...
        </p>
      ) : null}

      {recovery.errorMessage ? (
        <div className="web-error-notice" role="alert">
          <p>{recovery.errorMessage}</p>
          <button
            className="web-secondary-button"
            onClick={recovery.refresh}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!recovery.isLoading && !recovery.session ? (
        <section aria-labelledby="start-recovery-title" className="web-recovery-card">
          <h2 id="start-recovery-title">Choose the day to review</h2>
          <p>Only unfinished tasks scheduled for this day will be included.</p>
          <form
            className="web-recovery-start-form"
            onSubmit={(event) => {
              event.preventDefault();
              recovery.startSession(sourceDate);
            }}
          >
            <label htmlFor="recovery-source-date">Date</label>
            <input
              id="recovery-source-date"
              onChange={(event) => setSourceDate(event.currentTarget.value)}
              required
              type="date"
              value={sourceDate}
            />
            <button
              className="web-primary-button"
              disabled={recovery.isSaving}
              type="submit"
            >
              {recovery.isSaving ? "Starting..." : "Start Recovery Mode"}
            </button>
          </form>
          {recovery.latestCompletedSession ? (
            <p className="web-recovery-muted">
              Last completed review:{" "}
              {formatLocalDateForDisplay(recovery.latestCompletedSession.sourceDate)}
            </p>
          ) : null}
          <Link className="web-text-link" href="/">
            Return to Today
          </Link>
        </section>
      ) : null}

      {recovery.session ? (
        <div className="web-recovery-layout">
          <div>
            {currentItem ? (
              <article
                aria-labelledby="recovery-task-title"
                className="web-recovery-card"
              >
                <p className="web-eyebrow">
                  {currentItem.decision === "skip" ? "Ready to revisit" : "Review"}
                </p>
                <h2 id="recovery-task-title">{currentItem.originalTitle}</h2>
                <div className="web-task-meta">
                  <span>
                    {currentItem.originalScheduledTime
                      ? `Planned for ${currentItem.originalScheduledTime}`
                      : "Flexible timing"}
                  </span>
                  {currentItem.originalEstimatedDurationMinutes ? (
                    <span>
                      {currentItem.originalEstimatedDurationMinutes} min estimate
                    </span>
                  ) : null}
                </div>

                {actionMode ? (
                  <RecoveryActionForm
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
                  <div className="web-recovery-actions">
                    <DecisionButton
                      disabled={recovery.isSaving}
                      label="Keep, but unschedule"
                      onClick={() => runAndClose(() => recovery.keepTask(currentItem.id))}
                    />
                    <DecisionButton
                      disabled={recovery.isSaving}
                      label="Reschedule"
                      onClick={() => setActionMode("reschedule")}
                    />
                    <DecisionButton
                      disabled={recovery.isSaving}
                      label="Break into smaller tasks"
                      onClick={() => setActionMode("break_down")}
                    />
                    <DecisionButton
                      disabled={recovery.isSaving}
                      label="Delegate"
                      onClick={() => setActionMode("delegate")}
                    />
                    <DecisionButton
                      disabled={recovery.isSaving}
                      label="Remove from active tasks"
                      onClick={() => setActionMode("remove")}
                    />
                    <DecisionButton
                      disabled={recovery.isSaving}
                      label="Decide later"
                      onClick={() => runAndClose(() => recovery.skipTask(currentItem.id))}
                      quiet
                    />
                  </div>
                )}
              </article>
            ) : (
              <section className="web-recovery-card">
                <h2>Everything has a next step</h2>
                <p>Finish when you are ready. Your choices are already saved locally.</p>
              </section>
            )}

            {recovery.session.items.some((item) => item.status === "resolved") ? (
              <section
                aria-labelledby="recovery-decisions-title"
                className="web-recovery-decisions"
              >
                <h2 id="recovery-decisions-title">Decisions so far</h2>
                <ul>
                  {recovery.session.items
                    .filter((item) => item.status === "resolved")
                    .map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.originalTitle}</strong>
                          <span>{getRecoveryDecisionLabel(item.decision)}</span>
                        </div>
                        <button
                          aria-label={`Change decision for ${item.originalTitle}`}
                          className="web-secondary-button"
                          disabled={recovery.isSaving}
                          onClick={() => recovery.reopenItem(item.id)}
                          type="button"
                        >
                          Change
                        </button>
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="web-summary-panel" aria-labelledby="recovery-progress-title">
            <p className="web-eyebrow">Saved locally</p>
            <h2 id="recovery-progress-title">Progress</h2>
            <p className="web-recovery-progress">
              <strong>{getResolvedRecoveryItemCount(recovery.session)}</strong>
              <span>of {recovery.session.items.length} tasks decided</span>
            </p>
            <p className="web-summary-note">
              Reviewing {formatLocalDateForDisplay(recovery.session.sourceDate)}. You can
              leave and return without losing decisions.
            </p>
            {recovery.session.items.every((item) => item.status === "resolved") ? (
              <button
                className="web-primary-button web-recovery-finish"
                disabled={recovery.isSaving}
                onClick={recovery.completeSession}
                type="button"
              >
                {recovery.isSaving ? "Saving..." : "Finish Recovery Mode"}
              </button>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function DecisionButton({
  label,
  onClick,
  disabled,
  quiet = false
}: {
  label: string;
  onClick(): void;
  disabled: boolean;
  quiet?: boolean;
}) {
  return (
    <button
      className={`web-recovery-decision${quiet ? " is-quiet" : ""}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function RecoveryActionForm({
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
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onConfirm();
  };

  return (
    <form className="web-recovery-action-form" onSubmit={submit}>
      {mode === "reschedule" ? (
        <>
          <h3>Choose a new time</h3>
          <p>The task keeps its history and moves only after you save.</p>
          <label htmlFor="recovery-new-date">New date</label>
          <input
            id="recovery-new-date"
            onChange={(event) => onChangeRescheduledDate(event.currentTarget.value)}
            required
            type="date"
            value={rescheduledDate}
          />
          <label htmlFor="recovery-new-time">Time (optional)</label>
          <input
            id="recovery-new-time"
            onChange={(event) => onChangeRescheduledTime(event.currentTarget.value)}
            type="time"
            value={rescheduledTime}
          />
        </>
      ) : null}

      {mode === "break_down" ? (
        <>
          <h3>Name smaller tasks</h3>
          <p>Add at least two concrete pieces. They will start unscheduled.</p>
          {breakdownTitles.map((title, index) => (
            <div className="web-recovery-field" key={index}>
              <label htmlFor={`smaller-task-${index}`}>Smaller task {index + 1}</label>
              <input
                id={`smaller-task-${index}`}
                onChange={(event) =>
                  onChangeBreakdownTitle(index, event.currentTarget.value)
                }
                placeholder="A clear next step"
                required
                type="text"
                value={title}
              />
            </div>
          ))}
          <button
            className="web-secondary-button web-recovery-add-button"
            onClick={onAddBreakdownTitle}
            type="button"
          >
            Add another smaller task
          </button>
        </>
      ) : null}

      {mode === "delegate" ? (
        <>
          <h3>Delegate this task</h3>
          <p>Add an optional reminder about who or what happens next.</p>
          <label htmlFor="recovery-delegate-note">Note (optional)</label>
          <textarea
            id="recovery-delegate-note"
            onChange={(event) => onChangeDelegateNote(event.currentTarget.value)}
            placeholder="For example: Ask Sam on Friday"
            value={delegateNote}
          />
        </>
      ) : null}

      {mode === "remove" ? (
        <>
          <h3>Remove from active tasks?</h3>
          <p>
            “{item.originalTitle}” will leave active task lists, while its history and
            this decision remain stored.
          </p>
        </>
      ) : null}

      <div className="web-recovery-form-actions">
        <button className="web-primary-button" disabled={isSaving} type="submit">
          {isSaving ? "Saving..." : getConfirmLabel(mode)}
        </button>
        <button
          className="web-secondary-button"
          disabled={isSaving}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
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

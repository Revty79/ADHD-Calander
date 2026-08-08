import { Link, useFocusEffect } from "expo-router";
import { useCallback, useMemo } from "react";

import { TaskList } from "../../src/features/tasks/components/TaskList";
import { useTodayPlan } from "../../src/features/today/hooks/useTodayPlan";
import { isTaskActive, isTaskCompleted } from "../../src/types/task";
import { formatLocalDateForDisplay, getLocalDateString } from "../../src/utils/dates";

export default function WebTodayScreen() {
  const today = useMemo(() => getLocalDateString(), []);
  const {
    tasks,
    fixedEvents,
    isLoading,
    errorMessage,
    refresh,
    completeTask,
    undoCompletion
  } = useTodayPlan(today);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const activeTasks = tasks.filter(isTaskActive);
  const plannedTasks = activeTasks.filter((task) => task.scheduledTime !== null);
  const flexibleTasks = activeTasks.filter((task) => task.scheduledTime === null);
  const completedTasks = tasks.filter(isTaskCompleted);

  return (
    <div className="web-page">
      <header className="web-page-header">
        <div>
          <p className="web-eyebrow">Today</p>
          <h1>{formatLocalDateForDisplay(today)}</h1>
          <p className="web-page-intro">
            Fixed appointments, planned tasks, and flexible work in one calm view.
          </p>
        </div>
        <Link
          className="web-primary-link"
          href={{
            pathname: "/tasks/new",
            params: { scheduledDate: today, returnTo: "today" }
          }}
        >
          Add task
        </Link>
      </header>

      <Link
        className="web-today-recovery-link"
        href={{ pathname: "/recovery", params: { sourceDate: today } }}
      >
        <span>
          <strong>Today got away from me</strong>
          <small>Review unfinished tasks without moving fixed appointments.</small>
        </span>
        <b>Open Recovery Mode</b>
      </Link>

      {isLoading ? (
        <p aria-live="polite" className="web-loading-state" role="status">
          Loading today&apos;s plan...
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

      {!isLoading && !errorMessage ? (
        <div className="web-dashboard-grid">
          <div>
            <section className="web-task-section">
              <div className="web-section-heading">
                <h2>Fixed appointments</h2>
                <span className="web-count-badge">
                  {fixedEvents.length} {fixedEvents.length === 1 ? "event" : "events"}
                </span>
              </div>
              {fixedEvents.length === 0 ? (
                <p className="web-empty-state">No fixed appointments today.</p>
              ) : (
                <ul className="web-fixed-event-list">
                  {fixedEvents.map((event) => (
                    <li key={event.id}>
                      <time dateTime={event.startTime}>
                        {event.startTime}
                        {event.endTime ? `–${event.endTime}` : ""}
                      </time>
                      <div>
                        <strong>{event.title}</strong>
                        <span>Fixed</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <TaskList
              actionLabel="Complete"
              emptyMessage="No tasks have a set time today."
              onAction={completeTask}
              tasks={plannedTasks}
              title="Planned tasks"
            />
            <TaskList
              actionLabel="Complete"
              emptyMessage="No flexible tasks are scheduled for today."
              onAction={completeTask}
              tasks={flexibleTasks}
              title="Flexible tasks"
            />
            <TaskList
              actionLabel="Undo"
              emptyMessage="Completed tasks will appear here."
              onAction={undoCompletion}
              tasks={completedTasks}
              title="Completed"
            />
          </div>

          <aside aria-labelledby="today-summary-title" className="web-summary-panel">
            <p className="web-eyebrow">At a glance</p>
            <h2 id="today-summary-title">Today&apos;s plan</h2>
            <dl className="web-summary-list">
              <div>
                <dt>Fixed appointments</dt>
                <dd>{fixedEvents.length}</dd>
              </div>
              <div>
                <dt>Planned tasks</dt>
                <dd>{plannedTasks.length}</dd>
              </div>
              <div>
                <dt>Flexible tasks</dt>
                <dd>{flexibleTasks.length}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{completedTasks.length}</dd>
              </div>
            </dl>
            <p className="web-summary-note">
              These counts describe today without treating unfinished work as a failure.
            </p>
            <Link
              className="web-text-link web-today-recap-link"
              href={{ pathname: "/recap", params: { date: today } }}
            >
              Review today&apos;s recap
            </Link>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

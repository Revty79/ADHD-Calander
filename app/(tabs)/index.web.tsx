import { Link, useFocusEffect } from "expo-router";
import { useCallback, useMemo } from "react";

import { TaskList } from "../../src/features/tasks/components/TaskList";
import { useTasksForDate } from "../../src/features/tasks/hooks/useTasksForDate";
import { formatLocalDateForDisplay, getLocalDateString } from "../../src/utils/dates";

export default function WebTodayScreen() {
  const today = useMemo(() => getLocalDateString(), []);
  const { tasks, isLoading, errorMessage, refresh, completeTask, undoCompletion } =
    useTasksForDate(today);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const openTasks = tasks.filter((task) => task.status !== "completed");
  const completedTasks = tasks.filter((task) => task.status === "completed");

  return (
    <div className="web-page">
      <header className="web-page-header">
        <div>
          <p className="web-eyebrow">Today</p>
          <h1>{formatLocalDateForDisplay(today)}</h1>
          <p className="web-page-intro">A calm view of what is scheduled for today.</p>
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

      {isLoading ? (
        <p aria-live="polite" className="web-loading-state" role="status">
          Loading today&apos;s tasks...
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
            <TaskList
              actionLabel="Complete"
              emptyMessage="No tasks are scheduled for today."
              onAction={completeTask}
              tasks={openTasks}
              title="Open"
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
            <h2 id="today-summary-title">Today&apos;s tasks</h2>
            <dl className="web-summary-list">
              <div>
                <dt>Scheduled</dt>
                <dd>{tasks.length}</dd>
              </div>
              <div>
                <dt>Open</dt>
                <dd>{openTasks.length}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{completedTasks.length}</dd>
              </div>
            </dl>
            <p className="web-summary-note">
              Recovery Mode is planned for a later build. It will help reduce future
              workload without moving fixed commitments automatically.
            </p>
            <Link
              className="web-text-link"
              href={{
                pathname: "/tasks/new",
                params: { scheduledDate: today, returnTo: "today" }
              }}
            >
              Create a task for today
            </Link>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

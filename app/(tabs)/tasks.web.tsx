import { Link, useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { TaskList } from "../../src/features/tasks/components/TaskList";
import { useAllTasks } from "../../src/features/tasks/hooks/useAllTasks";
import { getLocalDateString } from "../../src/utils/dates";

export default function WebTasksScreen() {
  const today = getLocalDateString();
  const { tasks, isLoading, errorMessage, refresh, completeTask, undoCompletion } =
    useAllTasks();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const openTasks = tasks.filter((task) => task.status !== "completed");
  const completedTasks = tasks.filter((task) => task.status === "completed");

  return (
    <div className="web-page web-tasks-page">
      <header className="web-page-header">
        <div>
          <p className="web-eyebrow">All tasks</p>
          <h1>Tasks</h1>
          <p className="web-page-intro">
            Review every current task and its scheduled date.
          </p>
        </div>
        <Link
          className="web-primary-link"
          href={{
            pathname: "/tasks/new",
            params: { scheduledDate: today, returnTo: "tasks" }
          }}
        >
          Add task
        </Link>
      </header>

      {isLoading ? (
        <p aria-live="polite" className="web-loading-state" role="status">
          Loading tasks...
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
        <div className="web-wide-list">
          <TaskList
            actionLabel="Complete"
            emptyMessage="No open tasks yet."
            onAction={completeTask}
            showDate
            tasks={openTasks}
            title="Open tasks"
          />
          <TaskList
            actionLabel="Undo"
            emptyMessage="Completed tasks will appear here."
            onAction={undoCompletion}
            showDate
            tasks={completedTasks}
            title="Completed"
          />
        </div>
      ) : null}
    </div>
  );
}

import { Link, useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { TaskList } from "../../src/features/tasks/components/TaskList";
import { useAllTasks } from "../../src/features/tasks/hooks/useAllTasks";
import { isTaskActive, isTaskCompleted, isTaskResolved } from "../../src/types/task";

export default function WebTasksScreen() {
  const { tasks, isLoading, errorMessage, refresh, completeTask, undoCompletion } =
    useAllTasks();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const openTasks = tasks.filter(isTaskActive);
  const completedTasks = tasks.filter(isTaskCompleted);
  const resolvedTasks = tasks.filter(isTaskResolved);

  return (
    <div className="web-page web-tasks-page">
      <header className="web-page-header">
        <div>
          <p className="web-eyebrow">All tasks</p>
          <h1>Tasks</h1>
          <p className="web-page-intro">
            Review scheduled and unscheduled work in one calm list.
          </p>
        </div>
        <Link
          className="web-primary-link"
          href={{
            pathname: "/tasks/new",
            params: { returnTo: "tasks" }
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
          <TaskList
            emptyMessage="Recovery decisions will appear here."
            showDate
            tasks={resolvedTasks}
            title="Resolved in Recovery Mode"
          />
        </div>
      ) : null}
    </div>
  );
}

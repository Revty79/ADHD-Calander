import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";

import { TaskEditorForm } from "../../../src/features/tasks/components/TaskEditorForm";
import { useTaskDetail } from "../../../src/features/tasks/hooks/useTaskDetail";
import { UpdateTaskInput } from "../../../src/types/task";

export default function WebEditTaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const taskId = typeof params.id === "string" ? params.id : "";
  const detail = useTaskDetail(taskId);
  const refresh = detail.refresh;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function saveTask(input: UpdateTaskInput) {
    await detail.repository.updateTask(taskId, input);
    router.replace({ pathname: "/tasks/[id]", params: { id: taskId } });
  }

  return (
    <main className="web-form-shell">
      <div className="web-form-page">
        <Link
          className="web-back-link"
          href={{ pathname: "/tasks/[id]", params: { id: taskId } }}
        >
          Back to task
        </Link>
        <header className="web-form-header">
          <p className="web-eyebrow">Task details</p>
          <h1>Edit task</h1>
          <p>Changes update this task everywhere without creating a duplicate.</p>
        </header>

        {detail.isLoading && !detail.task ? (
          <p aria-live="polite" className="web-loading-state" role="status">
            Loading task...
          </p>
        ) : null}

        {!detail.isLoading && !detail.task ? (
          <div className="web-error-notice" role="alert">
            <p>{detail.errorMessage ?? "This task could not be found."}</p>
            <button
              className="web-secondary-button"
              onClick={detail.refresh}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        {detail.task ? (
          <TaskEditorForm
            initialTask={detail.task}
            key={detail.task.updatedAt}
            onSubmit={saveTask}
            submitLabel="Save changes"
          />
        ) : null}
      </div>
    </main>
  );
}

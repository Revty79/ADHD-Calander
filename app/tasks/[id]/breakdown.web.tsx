import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FormEvent, useCallback, useState } from "react";

import { TaskValidationError } from "../../../src/database/repositories/errors";
import { useTaskDetail } from "../../../src/features/tasks/hooks/useTaskDetail";

export default function WebBreakDownTaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const taskId = typeof params.id === "string" ? params.id : "";
  const detail = useTaskDetail(taskId);
  const refresh = detail.refresh;
  const [titles, setTitles] = useState(["", ""]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function saveBreakdown(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await detail.repository.breakDownTask(taskId, { titles });
      router.replace({ pathname: "/tasks/[id]", params: { id: taskId } });
    } catch (error) {
      setErrorMessage(
        error instanceof TaskValidationError
          ? error.message
          : "The smaller tasks could not be saved. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
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
          <p className="web-eyebrow">Smaller steps</p>
          <h1>Break down {detail.task?.title ?? "this task"}</h1>
          <p>
            Add at least two clear steps. The original stays as a visible container, and
            each smaller task can be planned and completed on its own.
          </p>
        </header>

        <form className="web-task-form" noValidate onSubmit={saveBreakdown}>
          {titles.map((title, index) => (
            <div className="web-breakdown-row" key={index}>
              <div className="web-form-group">
                <label htmlFor={`smaller-task-${index}`}>Smaller task {index + 1}</label>
                <input
                  id={`smaller-task-${index}`}
                  onChange={(event) => {
                    const value = event.currentTarget.value;

                    setTitles((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? value : item
                      )
                    );
                  }}
                  placeholder="A clear next step"
                  type="text"
                  value={title}
                />
              </div>
              {titles.length > 2 ? (
                <button
                  className="web-quiet-danger"
                  onClick={() =>
                    setTitles((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}

          {titles.length < 20 ? (
            <button
              className="web-secondary-button"
              onClick={() => setTitles((current) => [...current, ""])}
              type="button"
            >
              Add another smaller task
            </button>
          ) : null}

          {errorMessage ? (
            <div className="web-error-notice" role="alert">
              <p>{errorMessage}</p>
            </div>
          ) : null}

          <div className="web-form-actions">
            <button className="web-primary-button" disabled={isSaving} type="submit">
              {isSaving ? "Saving smaller tasks..." : "Create smaller tasks"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

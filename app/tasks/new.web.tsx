import { Href, Link, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";

import { useTaskRepository } from "../../src/database/DatabaseProvider";
import { TaskEditorForm } from "../../src/features/tasks/components/TaskEditorForm";
import { CreateTaskInput } from "../../src/types/task";
import { normalizeLocalDateInput } from "../../src/utils/dates";

type NewTaskParams = {
  scheduledDate?: string;
  returnTo?: string;
};

export default function WebNewTaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<NewTaskParams>();
  const taskRepository = useTaskRepository();
  const initialDate = useMemo(
    () => normalizeLocalDateInput(params.scheduledDate ?? "") ?? "",
    [params.scheduledDate]
  );
  const returnHref: Href =
    params.returnTo === "calendar"
      ? { pathname: "/calendar", params: { date: initialDate } }
      : params.returnTo === "tasks"
        ? "/tasks"
        : "/";
  const returnLabel =
    params.returnTo === "calendar"
      ? "Calendar"
      : params.returnTo === "tasks"
        ? "Tasks"
        : "Today";

  async function saveTask(input: CreateTaskInput) {
    const task = await taskRepository.createTask(input);

    if (params.returnTo === "calendar") {
      router.replace({
        pathname: "/(tabs)/calendar",
        params: { date: task.scheduledDate ?? initialDate }
      });
    } else {
      router.replace(params.returnTo === "tasks" ? "/(tabs)/tasks" : "/(tabs)");
    }
  }

  return (
    <main className="web-form-shell">
      <div className="web-form-page">
        <Link className="web-back-link" href={returnHref}>
          Back to {returnLabel}
        </Link>
        <header className="web-form-header">
          <p className="web-eyebrow">Quick capture</p>
          <h1>New task</h1>
          <p>A title is enough. Add planning details only when they help.</p>
        </header>
        <TaskEditorForm
          initialDate={initialDate}
          onSubmit={saveTask}
          submitLabel="Save task"
        />
      </div>
    </main>
  );
}

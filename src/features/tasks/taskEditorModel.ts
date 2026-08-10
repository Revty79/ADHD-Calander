import { Reminder, ReminderPermissionStatus } from "../../types/reminder";
import { CreateTaskInput, TaskImportance, TaskPlanningState } from "../../types/task";
import { TaskValidationError } from "../../database/repositories/errors";
import { getReminderDeliveryMessage } from "../reminders/reminderEditorModel";

export const taskDurationOptions: (number | null)[] = [null, 10, 15, 30, 45, 60, 90, 120];

export const taskImportanceOptions: { label: string; value: TaskImportance }[] = [
  { label: "Low", value: "low" },
  { label: "Normal", value: "normal" },
  { label: "Important", value: "important" }
];

export const taskPlanningOptions: { label: string; value: TaskPlanningState }[] = [
  { label: "Flexible", value: "flexible" },
  { label: "Planned", value: "planned" },
  { label: "Scheduled", value: "scheduled" }
];

export type TaskEditorDraft = {
  title: string;
  description: string;
  importance: TaskImportance;
  planningState: TaskPlanningState;
  scheduledDate: string;
  scheduledTime: string;
  preferredTime: string;
  estimatedDurationMinutes: number | null;
  deadlineDate: string;
  deadlineTime: string;
  reminders: Reminder[];
};

export function buildTaskEditorInput(draft: TaskEditorDraft): CreateTaskInput {
  if (draft.planningState !== "flexible" && !draft.scheduledDate.trim()) {
    throw new TaskValidationError(
      `Choose a date for this ${draft.planningState === "planned" ? "Planned" : "Scheduled"} task.`,
      "scheduledDate"
    );
  }

  if (draft.planningState === "scheduled" && !draft.scheduledTime.trim()) {
    throw new TaskValidationError(
      "Choose a start time for this Scheduled task.",
      "scheduledTime"
    );
  }

  return {
    title: draft.title,
    description: draft.description,
    importance: draft.importance,
    scheduledDate: draft.planningState === "flexible" ? null : draft.scheduledDate,
    scheduledTime: draft.planningState === "scheduled" ? draft.scheduledTime : null,
    preferredTime: draft.planningState === "planned" ? draft.preferredTime : null,
    estimatedDurationMinutes: draft.estimatedDurationMinutes,
    deadlineDate: draft.deadlineDate,
    deadlineTime: draft.deadlineDate ? draft.deadlineTime : null,
    reminders: draft.reminders
  };
}

export function getTaskPlanningTransition(
  nextState: TaskPlanningState,
  scheduledDate: string,
  scheduledTime: string,
  preferredTime: string,
  defaultScheduledDate: string
): {
  planningState: TaskPlanningState;
  scheduledDate: string;
  scheduledTime: string;
  preferredTime: string;
} {
  if (nextState === "flexible") {
    return {
      planningState: nextState,
      scheduledDate: "",
      scheduledTime: "",
      preferredTime: ""
    };
  }

  if (nextState === "planned") {
    return {
      planningState: nextState,
      scheduledDate: scheduledDate || defaultScheduledDate,
      scheduledTime: "",
      preferredTime: preferredTime || scheduledTime
    };
  }

  return {
    planningState: nextState,
    scheduledDate: scheduledDate || defaultScheduledDate,
    scheduledTime: scheduledTime || preferredTime,
    preferredTime: ""
  };
}

export function getTaskReminderDisabledMessage(
  _planningState: TaskPlanningState,
  permissionStatus: ReminderPermissionStatus | undefined,
  remindersEnabled: boolean | undefined
): string | null {
  return getReminderDeliveryMessage(permissionStatus, remindersEnabled);
}

export type GuideSection = {
  title: string;
  summary: string;
};

export const guideSections: GuideSection[] = [
  {
    title: "Today",
    summary:
      "Shows today's fixed events and active tasks. Start, pause, complete, undo, open, or edit a task from here."
  },
  {
    title: "Tasks",
    summary:
      "Keeps all task records together. A Flexible task has no planned date. A Planned task has a date and may have a preferred time. A Scheduled task has an exact date and start time."
  },
  {
    title: "Preferred time",
    summary:
      'Means "I would like to do this around then." It is a soft preference and does not reserve Calendar time.'
  },
  {
    title: "Scheduled time",
    summary:
      'Means "I placed this task at this exact time." Scheduled tasks occupy a real time interval.'
  },
  {
    title: "Importance, duration, and deadline",
    summary:
      'Importance is a simple Low, Normal, or Important label. Estimated duration records your practical estimate. A deadline means "This needs to be finished by this point." A date-only deadline means the end of that day.'
  },
  {
    title: "Reminders",
    summary:
      'A reminder means "Prompt me at this time; it does not change where the task is planned." Add up to five. Scheduled tasks and events can use relative reminders; every task can use custom reminder dates and times.'
  },
  {
    title: "Start, pause, complete, and undo",
    summary:
      "Start records that work began. Pause keeps the task available without changing its plan. Complete records when it finished, and Undo completion returns it to active work."
  },
  {
    title: "Edit and Break Down",
    summary:
      "Edit corrects the same saved task without replacing its identity or history. Break Down creates smaller unscheduled tasks and keeps the original relationship visible."
  },
  {
    title: "Calendar events",
    summary:
      "Events are fixed commitments. They stay separate from tasks and are never moved automatically. Add a color for scanning, or use Repeat for daily, weekly, monthly, yearly, and custom series."
  },
  {
    title: "Task and event colors",
    summary:
      "Color is an optional visual aid shared by tasks and events. Labels such as Fixed, Flexible, Planned, and Scheduled still explain what each item means."
  },
  {
    title: "Editing a recurring event",
    summary:
      "This event changes one occurrence. This and future events preserves the past and begins a new series. All events changes the whole series. The same choices protect recurring deletion."
  },
  {
    title: "Calendar",
    summary:
      "Month, Week, and Day views show fixed events separately from Planned and Scheduled tasks. Preferred time does not create a fixed block."
  },
  {
    title: "Plans changed? and Recovery",
    summary:
      "Recovery reviews unfinished dated work one task at a time. You can keep it unscheduled, reschedule, break it down, delegate, remove it, or decide later. Nothing is moved automatically."
  },
  {
    title: "Recap",
    summary:
      "Recap reports actual task completion times, fixed calendar commitments, and recorded Recovery decisions. It does not invent scores or streaks."
  },
  {
    title: "Settings",
    summary:
      "Turn Android reminder delivery on or off and adjust planning hours, transition buffers, and suggested-task limits. Reminder choices stay saved while delivery is off."
  }
];

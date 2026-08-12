# Calendar Architecture

## Purpose

Calendar is the structural center for the Plan -> Do -> Recover direction. This
foundation answers what is fixed, what work has been deliberately planned, and
what dated work remains flexible. Scheduling assistance may now suggest a place
for one flexible task, but never decides or moves work on its own.

## Domain Separation

`CalendarEvent` represents a fixed commitment. Its current `kind` is always
`fixed`. A non-recurring event is one stored row. A recurring event is one
stored series row plus sparse occurrence exceptions; visible occurrences are
derived only for the requested local-date range. `Task` represents work and can be:

- Unscheduled: no date or time.
- Flexible on a date: a date without a start time.
- Planned: a date with a start time.

Planning placement and execution state are separate. A task can be unscheduled,
flexible, or planned while its execution state is Not started, In progress, or
Completed. Starting and pausing never invent or change a schedule.

Calendar aggregation reads both repositories and keeps these categories
separate. Recovery Mode may update tasks only after an explicit decision, but
never reads fixed events as movable recovery work.

Daily Recap preserves the same boundary. Fixed events appear as “On your
calendar” facts and never as completed or attended accomplishments.

## Views

- Month uses a six-row traditional grid. Cells show compact fixed, task, and
  completed-task counts. Selecting a date opens its detail.
- Week shows seven factual day summaries and stored items. Wide layouts use
  columns; narrow layouts use a vertical list.
- Day groups items as Fixed, Planned, and Flexible and keeps completed tasks
  visible with a calm status label.
- Calendar exposes Add event and Add task as equally visible primary actions.
- Active tasks whose planned time or deadline has passed remain ordinary open
  work and use factual, non-alarming timing text.
- Tasks resolved as delegated, removed, or broken down remain in task history
  but no longer appear as active calendar work.

Current day and selected day each have non-color visual treatment. Event and
task cards use both text labels and different borders, so their meaning does not
depend on color alone. Tasks and events may independently use the shared calm
Neutral, Blue, Green, Amber, Lavender, or Rose tint. Month shows color markers
alongside factual counts, while Week and Day tint the labeled item cards.

## Workload Facts

`calendarSchedule.ts` adds only known minutes:

- Event duration when explicitly stored.
- Difference between explicit event start and end times.
- Task estimated duration when explicitly stored.

Unknown durations contribute zero. The UI does not label a day empty,
available, overloaded, or productive based on whitespace.

## Persistence

Native repository composition uses one initialized Expo SQLite database with
task, event, and recovery storage adapters. Web composition opens one IndexedDB
database and creates equivalent adapters. Recovery task mutations and recovery
decision writes share a storage transaction.

The calendar hook loads candidate event series for the visible local-date range,
loads sparse exceptions for those series, and expands only that bounded range.
It then filters scheduled tasks into the same range. Infinite recurrence rules
are never expanded without a caller-provided end date. Unscheduled tasks remain
available in Tasks but do not appear on a calendar date.

## Local Dates

Calendar arithmetic constructs local `Date` objects from validated components
and converts them back with local year, month, and day accessors. It does not
parse date-only strings as UTC. Local date/time fields are stored as strings,
while record-history timestamps use ISO instants.

Recap intentionally maps one record-history instant to a local date:
`completedAt` is converted with local date accessors to determine the day on
which completion actually occurred. It never substitutes the task's scheduled
date.

## Reminder Integration

A task or fixed event may store up to five reminders in the shared reminder
model. Explicit local date/time reminders are independent from placement;
relative reminders use an exact Scheduled task time or fixed-event start.
Reminder intent does not change Calendar grouping: fixed events remain fixed,
Scheduled tasks remain tasks, and Planned or Flexible tasks are not promoted by
a reminder. Item cards describe stored reminders with text, so state is not
communicated by color.

`ReminderService` builds one local trigger per reminder without parsing local
calendar strings through UTC. Deterministic identifiers include item identity
and either the legacy-compatible relative offset or explicit date/time key.
Synchronization cancels current, previous, supported-offset, and legacy
identifiers before rebuilding future triggers, so edits cannot leave stale OS
requests. A master setting controls Android delivery without erasing intent.
Completed, removed, or past-trigger items keep saved choices while delivery is
inactive; an untimed task can still deliver future explicit reminders.

Recurring relative event reminders are derived from each occurrence's local
date and start time. Android reconciles recurring occurrences from today through
a 90-day horizon, using occurrence identity in each relative notification ID.
Exception date, time, and reminder overrides replace the generated occurrence
values. Startup reconciliation cancels all pending app reminders before
rebuilding the horizon, while targeted edits cancel both previous and current
occurrence identifiers. Infinite series are never scheduled all at once.

Web keeps the same persisted domain shape and reminder editor behavior while
truthfully reporting that browser notification delivery is unsupported. Task
editing updates the existing record through `TaskRepository`. Native event
editing uses date/time pickers; web uses browser date/time controls. Both call
the same validation, recurrence, exception, and repository logic.

## Recurrence And Exceptions

Rules support daily, weekly, monthly, and yearly frequencies with a positive
interval. Weekly rules store one or more weekdays. Monthly rules store either
the anchor calendar date or an ordinal weekday from first through fourth or
last. End conditions are never, an inclusive local date, or a count of actual
occurrences. A same-date monthly rule skips months that do not contain that
date. A February 29 yearly rule occurs only in leap years; it is not shifted to
February 28 or March 1.

Occurrence identity is `series ID + original local occurrence date`. A modified
exception stores only fields that differ from the series; a cancelled exception
skips that occurrence. Moving one occurrence preserves its original identity.
"This and future" truncates the old rule before the selected original date and
creates a new series, preserving historical occurrences. "All events" updates
the series row. The same explicit scopes apply to deletion, and non-recurring
events never show a series-scope question.

## Scheduling Assistance Integration

Fixed events and active timed tasks are read as blockers by the pure scheduling
engine. Fixed events receive the configured transition buffer; timed tasks use
their exact known estimate and no extra fixed-event buffer. Untimed dated tasks
remain visible as flexible work but do not claim an exact interval. An accepted
suggestion updates the task's local date and time, so Calendar and Today read the
new placement through their existing repositories without a duplicate event.

Unknown timed durations are conservative blockers through the end of the
planning day. Calendar workload facts still count only known minutes; blocking
behavior does not invent duration or label a day overloaded.

## Deliberately Deferred

- Automatic scheduling, optimization, and rescheduling
- Automatic Recovery Mode scheduling
- Weekly availability and inferred capacity or overload labels
- All-day events
- Drag-and-drop
- Arbitrary relative reminder offsets and quiet hours
- Time-zone-aware travel behavior
- External calendar sync
- Accounts, cloud sync, analytics, and AI

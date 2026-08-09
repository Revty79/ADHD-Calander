# Calendar Architecture

## Purpose

Calendar is the structural center for the Plan -> Do -> Recover direction. This
foundation answers what is fixed, what work has an exact schedule, and what work
has been deliberately planned without an exact time. Scheduling assistance may
suggest a place for one active untimed task, but never decides or moves work on
its own.

## Domain Separation

`CalendarEvent` represents a fixed commitment. Its current `kind` is always
`fixed`. `Task` represents work and can be:

- Flexible: no date, exact time, or time-of-day preference.
- Planned: a date without an exact start time, optionally carrying a semantic
  Anytime, Morning, Afternoon, or Evening preference.
- Scheduled: a date with an exact start time.

Planning placement and execution state are separate. A task can be Flexible,
Planned, or Scheduled while its execution state is Not started, In progress, or
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
- Day groups items as Fixed, Scheduled, and Planned and keeps completed tasks
  visible with a calm status label.
- Calendar exposes Add event and Add task as equally visible primary actions.
- Active tasks whose planned time or deadline has passed remain ordinary open
  work and use factual, non-alarming timing text.
- Tasks resolved as delegated, removed, or broken down remain in task history
  but no longer appear as active calendar work.

Current day and selected day each have non-color visual treatment. Event and
task cards use both text labels and different borders, so their meaning does not
depend on color alone.

## Workload Facts

`calendarSchedule.ts` adds only known minutes:

- Event duration when explicitly stored.
- Difference between explicit event start and end times.
- Scheduled-task estimated duration when explicitly stored. Planned tasks do not
  claim scheduled minutes before an exact time is chosen.

Unknown durations contribute zero. The UI does not label a day empty,
available, overloaded, or productive based on whitespace.

## Persistence

Native repository composition uses one initialized Expo SQLite database with
task, event, and recovery storage adapters. Web composition opens one IndexedDB
database and creates equivalent adapters. Recovery task mutations and recovery
decision writes share a storage transaction.

The calendar hook loads events for the visible local-date range and filters
dated tasks into that range. Flexible tasks remain available in Tasks
but do not appear on a calendar date.

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

A task or fixed event may store up to five distinct reminder offsets from the
supported choices. Reminder intent does not change Calendar grouping: fixed
events remain fixed, exact-time tasks remain Scheduled, and dated untimed tasks
remain Planned. Native item cards describe stored reminders with text, so their
state is not communicated by color.

`ReminderService` builds one local trigger per valid offset from the item's
validated local date and time. Each request identifier includes the item type,
item ID, and offset. Synchronization cancels every supported current identifier
and the legacy single-reminder identifier before rebuilding future triggers, so
date and time changes cannot leave stale OS requests. A master setting controls
OS scheduling without erasing item intent. Completed, removed, untimed, or
past-trigger items keep their saved reminder choices while delivery remains
inactive.

Web keeps the same persisted domain shape but truthfully reports that browser
notification delivery is unsupported and does not render fake reminder
controls. Task editing updates the existing record through `TaskRepository`.
Event reminders can be selected during event creation; general event editing,
including later reminder changes, remains deferred.

Native fixed-event creation uses date, start-time, and end-time pickers or one
of the explicit duration choices 15, 30, 45, 60, 90, and 120 minutes. Web uses
semantic date/time inputs and the same duration choices. End time and duration
remain mutually exclusive. Browser reminders remain visibly unsupported rather
than presenting controls that cannot deliver notifications.

## Scheduling Assistance Integration

Fixed events and active timed tasks are read as blockers by the pure scheduling
engine. Fixed events receive the configured transition buffer; timed tasks use
their exact known estimate and no extra fixed-event buffer. Untimed dated tasks
remain visible as Planned work but do not claim an exact interval. An accepted
suggestion updates the task's local date and time, so Calendar and Today read the
new placement through their existing repositories without a duplicate event.

Unknown timed durations are conservative blockers through the end of the
planning day. Calendar workload facts still count only known minutes; blocking
behavior does not invent duration or label a day overloaded.

## Deliberately Deferred

- Automatic scheduling, optimization, and rescheduling
- Automatic Recovery Mode scheduling
- Weekly availability and inferred capacity or overload labels
- Recurring or all-day events
- Event editing/deletion
- Drag-and-drop
- Custom reminder offsets, quiet hours, and event reminder editing
- Time-zone-aware travel behavior
- External calendar sync
- Accounts, cloud sync, analytics, and AI

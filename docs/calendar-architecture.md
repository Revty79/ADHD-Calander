# Calendar Architecture

## Purpose

Calendar is the structural center for the Plan -> Do -> Recover direction. This
foundation answers what is fixed, what work has been deliberately planned, and
what dated work remains flexible. It does not yet decide what should move.

## Domain Separation

`CalendarEvent` represents a fixed commitment. Its current `kind` is always
`fixed`. `Task` represents work and can be:

- Unscheduled: no date or time.
- Flexible on a date: a date without a start time.
- Planned: a date with a start time.

Calendar aggregation reads both repositories and keeps these categories
separate. Future scheduling and Recovery Mode may propose changes to tasks, but
must not automatically move fixed events.

## Views

- Month uses a six-row traditional grid. Cells show compact fixed, task, and
  completed-task counts. Selecting a date opens its detail.
- Week shows seven factual day summaries and stored items. Wide layouts use
  columns; narrow layouts use a vertical list.
- Day groups items as Fixed, Planned, and Flexible and keeps completed tasks
  visible with a calm status label.

Current day and selected day each have non-color visual treatment. Event and
task cards use both text labels and different borders, so their meaning does not
depend on color alone.

## Workload Facts

`calendarSchedule.ts` adds only known minutes:

- Event duration when explicitly stored.
- Difference between explicit event start and end times.
- Task estimated duration when explicitly stored.

Unknown durations contribute zero. The UI does not label a day empty,
available, overloaded, or productive based on whitespace.

## Persistence

Native repository composition uses one initialized Expo SQLite database with
`SqlTaskStorage` and `SqlCalendarEventStorage`. Web composition opens one
IndexedDB database and creates task and event adapters for their object stores.
The provider exposes both repositories to hooks and forms.

The calendar hook loads events for the visible local-date range and filters
scheduled tasks into that range. Unscheduled tasks remain available in Tasks
but do not appear on a calendar date.

## Local Dates

Calendar arithmetic constructs local `Date` objects from validated components
and converts them back with local year, month, and day accessors. It does not
parse date-only strings as UTC. Local date/time fields are stored as strings,
while record-history timestamps use ISO instants.

## Deliberately Deferred

- Automatic scheduling and rescheduling
- Full Recovery Mode
- Capacity and overload rules
- Recurring or all-day events
- Event and task editing/deletion
- Drag-and-drop
- Notifications
- Time-zone-aware travel behavior
- External calendar sync
- Accounts, cloud sync, analytics, and AI

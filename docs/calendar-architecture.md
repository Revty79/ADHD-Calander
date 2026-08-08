# Calendar Architecture

## Purpose

Calendar is the structural center for the Plan -> Do -> Recover direction. This
foundation answers what is fixed, what work has been deliberately planned, and
what dated work remains flexible. Scheduling assistance may now suggest a place
for one flexible task, but never decides or moves work on its own.

## Domain Separation

`CalendarEvent` represents a fixed commitment. Its current `kind` is always
`fixed`. `Task` represents work and can be:

- Unscheduled: no date or time.
- Flexible on a date: a date without a start time.
- Planned: a date with a start time.

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
- Tasks resolved as delegated, removed, or broken down remain in task history
  but no longer appear as active calendar work.

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
task, event, and recovery storage adapters. Web composition opens one IndexedDB
database and creates equivalent adapters. Recovery task mutations and recovery
decision writes share a storage transaction.

The calendar hook loads events for the visible local-date range and filters
scheduled tasks into that range. Unscheduled tasks remain available in Tasks
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

A task or fixed event may store one optional reminder offset. Reminder intent
does not change the Calendar grouping: fixed events remain fixed, timed tasks
remain planned, and untimed tasks remain flexible. Native item cards show the
stored reminder as text, so its state is not communicated by color.

`ReminderService` builds a local trigger from the item's validated local date
and time. A master setting controls OS scheduling without erasing item intent.
Web keeps the same domain shape but does not schedule browser notifications.
General event/task editing remains deferred; future edits must cancel the old
identifier before scheduling against a changed date or time.

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
- Recurring or all-day events
- Event and task editing/deletion
- Drag-and-drop
- Advanced notifications, quiet hours, and reminder editing
- Time-zone-aware travel behavior
- External calendar sync
- Accounts, cloud sync, analytics, and AI

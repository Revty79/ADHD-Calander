# MVP Scope

## Included MVP Features

- Create and schedule tasks.
- Choose a realistic number of daily priorities.
- Break large tasks into manageable steps.
- Record completed and partially completed work.
- Adjust the day when available energy changes.
- Enter a recovery workflow when the day falls apart.
- Reschedule missed work without overloading the following day.
- Produce factual end-of-day accomplishment summaries from recorded actions.
- Work offline for core task-management behavior.

## Deferred Features

- Cloud synchronization
- AI assistance
- External calendar integrations
- Subscriptions and payments
- Advanced notification strategy
- Final visual brand system
- Cross-device account model

## Current First-Build Scope

- Expo Router navigation for Today, Calendar, Tasks, Recovery, Recap, and Settings on
  Android, future iOS builds, and responsive web browsers.
- Functional Today, Calendar, and Tasks screens.
- Month, Week, and Day calendar views with selectable dates and factual schedule
  summaries.
- Basic fixed-event creation with title, date, start time, optional end time or
  duration, and optional notes.
- Local task creation with optional description, scheduled date, scheduled
  time, and duration estimate. Unscheduled tasks are valid.
- SQLite-backed task and event persistence through app restarts.
- Task completion and completion undo.
- Versioned migrations that preserve existing task data.
- Repository and aggregation tests for events, scheduled and unscheduled tasks,
  chronological ordering, persistence, validation, and local dates.
- Responsive web sidebar and compact-width navigation.
- IndexedDB-backed task and event persistence through refreshes and browser
  restarts.
- Browser task creation with semantic date and time inputs.
- Shared repository behavior across SQLite and IndexedDB storage adapters.

## Out Of Scope For First Build

- Recovery Mode implementation
- Recap implementation
- Three-priority planning system
- Task steps
- Task editing
- Soft deletion UI
- Notifications
- Recurring calendar events
- External calendar integration
- Event and task editing or deletion
- Cloud services
- AI services
- Payments

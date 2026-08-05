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

- Expo Router tab navigation for Today, Tasks, Recovery, Recap, and Settings.
- Functional Today and Tasks screens.
- Basic local task creation with title, optional description, scheduled date,
  and optional scheduled time.
- SQLite-backed persistence through app restarts.
- Task completion and completion undo.
- Versioned initial database migration.
- Repository tests for migration, task creation, date retrieval, completion,
  undo, persistence, validation, local dates, and database errors.

## Out Of Scope For First Build

- Recovery Mode implementation
- Recap implementation
- Three-priority planning system
- Task steps
- Task editing
- Soft deletion UI
- Notifications
- Calendar integration
- Cloud services
- AI services
- Payments

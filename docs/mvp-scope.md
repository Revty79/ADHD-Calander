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

## Monetization Boundary

Advertising, subscriptions, ad-free entitlements, and Google Play Billing are
not part of the current Tasks phase and must not be implemented during it.
Monetization will have a separate approved implementation phase.

Core planning domain logic, repositories, scheduling, Recovery, and offline
task behavior must not depend on advertising or billing implementations. A
future monetization phase should add advertising, entitlement, and Google Play
Billing adapters at explicit boundaries without coupling them to core planning
behavior. This is an architecture constraint, not approval to add placeholder
monetization controls or speculative services now.

## Current First-Build Scope

- Expo Router navigation for Today, Calendar, Tasks, Recovery, Recap, and Settings on
  Android, future iOS builds, and responsive web browsers.
- Functional Today, Calendar, Tasks, and Recovery screens.
- Month, Week, and Day calendar views with selectable dates and factual schedule
  summaries.
- Basic fixed-event creation with title, date, start time, optional end time or
  duration, and optional notes.
- Quick task creation with optional notes, importance, derived Flexible/Planned/
  Scheduled state, duration estimate, deadline, and reminders. Native pickers,
  browser controls, and quick local-date choices avoid formatted date/time
  entry. A title alone is valid.
- Persisted Start task and Pause for now actions, with execution state shown
  separately from Flexible, Planned, and Scheduled planning state.
- Task detail and editing that preserve identity and update Today, Calendar,
  scheduling, and reminder behavior through the shared repository.
- Manual and Recovery breakdown using the same persisted parent/child task
  relationship, with individually editable and completable smaller tasks.
- Confirmed removal from active tasks, restoration, completion undo, and
  breakdown undo when no smaller task has recorded progress.
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
- One-task-at-a-time Recovery Mode sessions for unfinished dated tasks.
- Explicit Keep, Reschedule, Break Down, Delegate, Remove, and Decide Later
  recovery decisions.
- Persisted recovery progress that resumes after leaving or restarting the app.
- Reversible recovery decisions while a session remains active.
- A derived Daily Recap for today and recent local dates.
- Accomplishments based on actual completion timestamps rather than schedule
  placement.
- Factual fixed-event context, Recovery decision summaries, and calm still-open
  context without grades, streaks, or productivity scores.
- A functional, calm Settings destination with local reminder control,
  permission status, accessibility guidance, local-data facts, and app version.
- Up to five optional local reminders for a native scheduled task or fixed
  event, using a small set of offsets, distinct notification identities, and
  safe future-trigger filtering.
- Reminder cancellation on task completion and synchronization for Keep,
  Reschedule, Break Down, Delegate, Remove, and reopen Recovery actions.
- SQLite and IndexedDB settings persistence behind a shared repository boundary.
- Accurate web notification-unavailable status without requesting browser
  permission or adding fake notification behavior.
- Optional task deadlines that remain distinct from scheduled dates.
- A pure deterministic scheduler that considers fixed events, timed tasks,
  estimates, deadlines, local planning hours, fixed-event transition buffers,
  and a daily suggested-task-time limit.
- A Tasks entry point that shows at most three suggestions and requires a
  separate confirmation before updating the existing task.
- Planning preferences persisted in SQLite and IndexedDB with calm native and
  web controls.
- Comparable Calendar Add event/Add task actions, a prominent Tasks Add task
  action, and a global confirmation-gated Plans changed? Recovery shortcut.

## Out Of Scope For First Build

- Partial-progress entry or percentage tracking
- Three-priority planning system
- Multi-level project management beyond direct task breakdown
- Advanced notifications, quiet hours, snooze, and arbitrary custom reminders
- Recurring calendar events
- External calendar integration
- Event editing or deletion
- Cloud services
- AI services
- Payments
- Advertising, subscriptions, entitlements, and Google Play Billing
- AI, natural-language scheduling, predictive energy modeling, or behavioral
  profiling
- Automatic schedule filling, optimization, or Recovery rescheduling
- Weekly availability grids and preferred-time or energy fields

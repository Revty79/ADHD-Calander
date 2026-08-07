# Data Model

## Domain Boundaries

Tasks and calendar events are separate domain entities. A calendar event is a
fixed commitment and is never treated as movable work. A task remains a work
item and may be unscheduled, associated with a date, or planned for a local
start time. This separation is required for future scheduling and Recovery Mode
logic.

All platforms use the shared `TaskRepository`, `CalendarEventRepository`, and
`RecoveryRepository`. Repositories own validation and domain behavior and depend
on platform-neutral storage contracts. Screens never issue SQL or IndexedDB
requests directly.

## Local Date And Time Strategy

Date-only values use validated `YYYY-MM-DD` strings. Local wall-clock times use
validated 24-hour `HH:MM` strings. They are not converted through UTC or stored
as JavaScript timestamps, so an item entered for August 6 remains on August 6
in the user's local calendar.

Creation and update timestamps are ISO instants. They describe record history,
not calendar placement.

## Native Persistence

Android and future iOS builds use Expo SQLite with versioned SQL migrations.

### `schema_migrations`

| Column       | Type    | Notes                                              |
| ------------ | ------- | -------------------------------------------------- |
| `version`    | integer | Primary key migration version.                     |
| `name`       | text    | Human-readable migration name.                     |
| `applied_at` | text    | ISO timestamp for when the migration was recorded. |

### `tasks`

| Column                       | Type    | Notes                                                                                         |
| ---------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `id`                         | text    | Unique task ID.                                                                               |
| `title`                      | text    | Required trimmed title.                                                                       |
| `description`                | text    | Optional trimmed description.                                                                 |
| `status`                     | text    | Implemented values are `not_started`, `completed`, `delegated`, `removed`, and `broken_down`. |
| `scheduled_date`             | text    | Optional local `YYYY-MM-DD` date.                                                             |
| `scheduled_time`             | text    | Optional local `HH:MM` time; requires a scheduled date.                                       |
| `estimated_duration_minutes` | integer | Optional positive whole-number estimate.                                                      |
| `created_at`                 | text    | ISO timestamp.                                                                                |
| `updated_at`                 | text    | ISO timestamp.                                                                                |
| `completed_at`               | text    | Optional ISO timestamp set on completion.                                                     |
| `deleted_at`                 | text    | Optional ISO timestamp reserved for future soft deletion.                                     |

Delegated, removed, and broken-down tasks remain stored as recovery history but
are excluded from active Today and Calendar work. The status constraint also
reserves future values so later migrations do not
need to rewrite rows only to recognize planned states: `started`,
`partially_completed`, `intentionally_skipped`, `rescheduled`,
`recovery_queue`, and `no_longer_necessary`.

### `calendar_events`

| Column             | Type    | Notes                                                  |
| ------------------ | ------- | ------------------------------------------------------ |
| `id`               | text    | Unique event ID.                                       |
| `title`            | text    | Required trimmed title.                                |
| `kind`             | text    | Currently constrained to `fixed`.                      |
| `date`             | text    | Required local `YYYY-MM-DD` date.                      |
| `start_time`       | text    | Required local `HH:MM` start.                          |
| `end_time`         | text    | Optional local end time, not earlier than start.       |
| `duration_minutes` | integer | Optional positive duration used instead of `end_time`. |
| `notes`            | text    | Optional trimmed notes.                                |
| `created_at`       | text    | ISO timestamp.                                         |
| `updated_at`       | text    | ISO timestamp.                                         |

An event may have an end time or a duration, but not both. Both may be omitted
when the duration is unknown. Calendar workload summaries count only known
minutes and never infer availability or overload.

### `recovery_sessions`

| Column         | Type | Notes                                     |
| -------------- | ---- | ----------------------------------------- |
| `id`           | text | Unique recovery session ID.               |
| `source_date`  | text | Reviewed local `YYYY-MM-DD` date.         |
| `status`       | text | `active` or `completed`.                  |
| `started_at`   | text | ISO timestamp.                            |
| `completed_at` | text | ISO timestamp set on explicit completion. |

A partial unique index permits only one `active` session.

### `recovery_items`

| Column                                | Type    | Notes                                                                      |
| ------------------------------------- | ------- | -------------------------------------------------------------------------- |
| `id`                                  | text    | Unique recovery item ID.                                                   |
| `session_id`                          | text    | Parent recovery session.                                                   |
| `task_id`                             | text    | Original task being reviewed.                                              |
| `original_title`                      | text    | Snapshot of the original title.                                            |
| `original_status`                     | text    | Snapshot used when an active decision is reopened.                         |
| `original_scheduled_date`             | text    | Snapshot local date.                                                       |
| `original_scheduled_time`             | text    | Optional snapshot local time.                                              |
| `original_estimated_duration_minutes` | integer | Optional snapshot estimate.                                                |
| `status`                              | text    | `pending` or `resolved`.                                                   |
| `decision`                            | text    | `keep`, `reschedule`, `break_down`, `delegate`, `remove`, `skip`, or null. |
| `note`                                | text    | Optional local delegation note.                                            |
| `rescheduled_date`                    | text    | Explicitly selected local date.                                            |
| `rescheduled_time`                    | text    | Optional explicitly selected local time.                                   |
| `created_task_ids`                    | text    | JSON array of tasks generated by Break Down.                               |
| `reviewed_at`                         | text    | ISO timestamp for the latest decision.                                     |
| `created_at`                          | text    | ISO timestamp.                                                             |
| `updated_at`                          | text    | ISO timestamp.                                                             |

Each session contains at most one item for a task. Recovery item updates and
their task mutations share a transaction.

## SQL Migrations

### Version 1: `create_tasks`

`src/database/migrations/001_create_tasks.ts` creates the initial required-date
task table and indexes scheduled-date and update-timestamp access patterns.

### Version 2: `calendar_foundation`

`src/database/migrations/002_calendar_foundation.ts` rebuilds `tasks` with a
nullable scheduled date, adds `estimated_duration_minutes`, copies every
existing task unchanged, recreates task indexes, and creates the
`calendar_events` table and its date/start-time and update-time indexes.

### Version 3: `recovery_foundation`

`src/database/migrations/003_recovery_foundation.ts` rebuilds `tasks` with the
expanded recovery status constraint while copying every existing row, recreates
task indexes, and adds recovery session and item tables plus their indexes.

## Web Persistence

The web build uses IndexedDB database version 3. It has:

- `tasks`, keyed by task ID with `scheduledDate` and `updatedAt` indexes.
- `calendarEvents`, keyed by event ID with `date` and `updatedAt` indexes.
- `recoverySessions`, keyed by session ID with `status` and `completedAt` indexes.
- `recoveryItems`, keyed by item ID with `sessionId` and `status` indexes.

Version 2 preserves the existing version 1 task store and adds the event store.
Version 3 preserves both stores and adds recovery storage. Older task records
without `estimatedDurationMinutes` deserialize with a `null` estimate. Stored
records are validated when read.

Browser data is local to the browser profile and application origin. It remains
after refreshes and ordinary browser restarts, but private browsing, storage
pressure, policy restrictions, or clearing site data can remove it. Browser and
native data are intentionally separate.

## Deferred Data Work

Recurring events, event editing/deletion, task editing/deletion, time zones,
all-day events, external calendar identifiers, notifications, day plans,
recovery analytics, import/export, accounts, and cloud synchronization are not
part of this foundation.

Cloud synchronization remains unapproved. A future design must explicitly
address privacy, authentication, conflict resolution, offline reconciliation,
and migration from both local stores.

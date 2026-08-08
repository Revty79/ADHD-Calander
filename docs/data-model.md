# Data Model

## Domain Boundaries

Tasks and calendar events are separate domain entities. A calendar event is a
fixed commitment and is never treated as movable work. A task remains a work
item and may be unscheduled, associated with a date, or planned for a local
start time. This separation is required for future scheduling and Recovery Mode
logic.

All platforms use the shared `TaskRepository`, `CalendarEventRepository`,
`RecoveryRepository`, and `SettingsRepository`. `DailyRecapRepository` composes
the planning repositories as a read-only derived-data service. `ReminderService`
coordinates stored reminder intent with a platform notification adapter.
`SchedulingService` composes task, event, and settings repositories to gather
inputs and explicitly accept a revalidated suggestion. The pure scheduler reads
domain values and returns candidates without persistence or notification calls.
Repositories own validation and domain behavior and depend on platform-neutral
storage contracts. Screens never issue SQL or IndexedDB requests directly.

## Local Date And Time Strategy

Date-only values use validated `YYYY-MM-DD` strings. Local wall-clock times use
validated 24-hour `HH:MM` strings. They are not converted through UTC or stored
as JavaScript timestamps, so an item entered for August 6 remains on August 6
in the user's local calendar.

Creation and update timestamps are ISO instants. They describe record history,
not calendar placement.

`completed_at` is also an ISO instant. It is set when a task is completed,
cleared when completion is undone, and set to a new instant when that task is
completed again. Daily Recap converts this instant to the device's local date;
it does not use `scheduled_date` as a substitute for completion history.

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
| `deadline_date`              | text    | Optional local `YYYY-MM-DD` last day; distinct from planned date/time.                        |
| `reminder_offset_minutes`    | integer | Optional one-reminder intent: `0`, `10`, `30`, or `60` minutes before the scheduled time.     |
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

| Column                    | Type    | Notes                                                                        |
| ------------------------- | ------- | ---------------------------------------------------------------------------- |
| `id`                      | text    | Unique event ID.                                                             |
| `title`                   | text    | Required trimmed title.                                                      |
| `kind`                    | text    | Currently constrained to `fixed`.                                            |
| `date`                    | text    | Required local `YYYY-MM-DD` date.                                            |
| `start_time`              | text    | Required local `HH:MM` start.                                                |
| `end_time`                | text    | Optional local end time, not earlier than start.                             |
| `duration_minutes`        | integer | Optional positive duration used instead of `end_time`.                       |
| `notes`                   | text    | Optional trimmed notes.                                                      |
| `reminder_offset_minutes` | integer | Optional one-reminder intent: `0`, `10`, `30`, or `60` minutes before start. |
| `created_at`              | text    | ISO timestamp.                                                               |
| `updated_at`              | text    | ISO timestamp.                                                               |

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
| `original_reminder_offset_minutes`    | integer | Optional reminder snapshot used when a decision is reopened.               |
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

### `app_settings`

| Column       | Type | Notes                                                          |
| ------------ | ---- | -------------------------------------------------------------- |
| `key`        | text | Primary key for one local preference.                          |
| `value`      | text | Serialized preference value validated by `SettingsRepository`. |
| `updated_at` | text | ISO timestamp for the latest explicit setting change.          |

Supported keys are `reminders_enabled`, `planning_day_start`,
`planning_day_end`, `transition_buffer_minutes`, and
`max_suggested_task_minutes_per_day`. Missing rows use repository defaults of
reminders off, 08:00–20:00 planning hours, a 15-minute fixed-event buffer, and
180 maximum suggested task minutes per day. A key/value table avoids coupling
app preferences to task or event records.

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

### Version 4: `settings_reminders_foundation`

`src/database/migrations/004_settings_reminders_foundation.ts` adds nullable,
constrained reminder offsets to tasks and events, snapshots reminder intent on
Recovery items, and creates `app_settings`. Existing rows receive `null`
reminder fields and remain otherwise unchanged.

### Version 5: `scheduling_assistance_foundation`

`src/database/migrations/005_scheduling_assistance_foundation.ts` adds nullable
`tasks.deadline_date`. Existing tasks receive `null`; scheduled dates, estimates,
status, reminders, and identity remain unchanged.

### Daily Recap Foundation

No migration is required. Recap derives its view from the existing nullable
`tasks.completed_at`, calendar-event, and Recovery session/item records. It
does not persist duplicate daily summary rows.

## Web Persistence

The web build uses IndexedDB database version 5. It has:

- `tasks`, keyed by task ID with `scheduledDate` and `updatedAt` indexes.
- `calendarEvents`, keyed by event ID with `date` and `updatedAt` indexes.
- `recoverySessions`, keyed by session ID with `status` and `completedAt` indexes.
- `recoveryItems`, keyed by item ID with `sessionId` and `status` indexes.
- `appSettings`, keyed by setting key.

Version 2 preserves the existing version 1 task store and adds the event store.
Version 3 preserves both stores and adds recovery storage. Version 4 preserves
all existing stores and adds `appSettings`. Version 5 keeps those stores and
introduces the scheduling task shape without rewriting records. Older task,
event, and Recovery item records without reminder metadata deserialize with
`null` reminder intent.
Older task records without `estimatedDurationMinutes` deserialize with a `null`
estimate, and records without `deadlineDate` receive a `null` deadline. Older
task records that omit `completedAt` deserialize with a `null`
completion time and are not assigned to a historical Recap date. Stored records
are validated when read.

Browser data is local to the browser profile and application origin. It remains
after refreshes and ordinary browser restarts, but private browsing, storage
pressure, policy restrictions, or clearing site data can remove it. Browser and
native data are intentionally separate.

## Deferred Data Work

Recurring events, event editing/deletion, task editing/deletion, time zones,
all-day events, external calendar identifiers, advanced notification policy,
quiet hours, default reminders, day plans,
recovery analytics, partial-progress measurement, earliest-start constraints,
preferred work periods, energy requirements, import/export, accounts, and cloud
synchronization are not part of this foundation.

Cloud synchronization remains unapproved. A future design must explicitly
address privacy, authentication, conflict resolution, offline reconciliation,
and migration from both local stores.

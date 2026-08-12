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

These strings are storage and domain representations, not user-entry formats.
Native task and Recovery flows use date/time pickers, while web uses semantic
browser date/time controls and quick local-date choices.

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

| Column                       | Type    | Notes                                                                                                                     |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`                         | text    | Unique task ID.                                                                                                           |
| `title`                      | text    | Required trimmed title.                                                                                                   |
| `description`                | text    | Optional trimmed description.                                                                                             |
| `importance`                 | text    | `low`, `normal`, or `important`; legacy rows default to `normal`.                                                         |
| `color`                      | text    | Shared visual-aid key; version 11 defaults existing rows to `neutral`.                                                    |
| `status`                     | text    | Implemented values are `not_started`, `started`, `completed`, `delegated`, `removed`, and `broken_down`.                  |
| `parent_task_id`             | text    | Optional self-reference for a smaller task created by breakdown.                                                          |
| `scheduled_date`             | text    | Optional local `YYYY-MM-DD` date.                                                                                         |
| `scheduled_time`             | text    | Optional local `HH:MM` time; requires a scheduled date.                                                                   |
| `preferred_time`             | text    | Optional local `HH:MM` soft preference; requires a scheduled date and no `scheduled_time`.                                |
| `planned_time_preference`    | text    | Compatibility-only migration 008 field; retained but ignored by current product behavior.                                 |
| `estimated_duration_minutes` | integer | Optional positive whole-number estimate.                                                                                  |
| `deadline_date`              | text    | Optional local `YYYY-MM-DD` last day; distinct from planned date/time.                                                    |
| `deadline_time`              | text    | Optional local `HH:MM` finish boundary; requires `deadline_date`. Date-only deadlines end at local midnight.              |
| `reminder_offset_minutes`    | integer | Legacy single-reminder column retained for upgrade compatibility; new writes use `reminder_offsets`.                      |
| `reminder_offsets`           | text    | Legacy-compatible JSON projection of relative offsets; supported values are `0`, `5`, `10`, `15`, `30`, `60`, and `1440`. |
| `reminders`                  | text    | Nullable authoritative JSON array of up to five relative or explicit local date/time reminders.                           |
| `started_at`                 | text    | Optional ISO timestamp for the most recent Start task action.                                                             |
| `created_at`                 | text    | ISO timestamp.                                                                                                            |
| `updated_at`                 | text    | ISO timestamp.                                                                                                            |
| `completed_at`               | text    | Optional ISO timestamp set on completion.                                                                                 |
| `deleted_at`                 | text    | Optional ISO timestamp reserved for future soft deletion.                                                                 |

Planning state is derived rather than stored redundantly: no date is Flexible,
a date without `scheduled_time` is Planned, and a date with `scheduled_time` is
Scheduled. A Planned task may have `preferred_time` without becoming Scheduled
or claiming a hard interval. A deadline remains independent from all three
states. Without `deadline_time`, its boundary is the end of the local deadline
date; an exact deadline time is a hard finish boundary.

Execution state is separate: `not_started`, `started`, and `completed` describe
whether work has begun, while the date/time fields describe planning. Pausing
changes `started` back to `not_started` but preserves `started_at` as factual
history. Completion always uses `completed_at`; Daily Recap never treats
`started_at` as completion.

Delegated, removed, and broken-down tasks remain stored as task history but are
excluded from active Today and Calendar work. A manual or Recovery breakdown
marks the original `broken_down` and creates unscheduled child tasks whose
`parent_task_id` references it. The status constraint also
reserves future values so later migrations do not
need to rewrite rows only to recognize planned states: `partially_completed`,
`intentionally_skipped`, `rescheduled`,
`recovery_queue`, and `no_longer_necessary`.

### `calendar_events`

| Column                    | Type    | Notes                                                                  |
| ------------------------- | ------- | ---------------------------------------------------------------------- |
| `id`                      | text    | Unique event ID.                                                       |
| `title`                   | text    | Required trimmed title.                                                |
| `kind`                    | text    | Currently constrained to `fixed`.                                      |
| `date`                    | text    | Required local `YYYY-MM-DD` date.                                      |
| `start_time`              | text    | Required local `HH:MM` start.                                          |
| `end_time`                | text    | Optional local end time, not earlier than start.                       |
| `duration_minutes`        | integer | Optional positive duration used instead of `end_time`.                 |
| `notes`                   | text    | Optional trimmed notes.                                                |
| `color`                   | text    | Shared visual-aid key; version 11 defaults existing rows to `neutral`. |
| `reminder_offset_minutes` | integer | Legacy single-reminder column retained for upgrade compatibility.      |
| `reminder_offsets`        | text    | Legacy-compatible JSON projection of relative reminder offsets.        |
| `reminders`               | text    | Nullable authoritative JSON array of up to five reminders.             |
| `recurrence_rule`         | text    | Nullable JSON recurrence rule. `NULL` means a normal event.            |
| `created_at`              | text    | ISO timestamp.                                                         |
| `updated_at`              | text    | ISO timestamp.                                                         |

An event may have an end time or a duration, but not both. Both may be omitted
when the duration is unknown. Calendar workload summaries count only known
minutes and never infer availability or overload.

### `calendar_event_exceptions`

| Column          | Type | Notes                                                                             |
| --------------- | ---- | --------------------------------------------------------------------------------- |
| `id`            | text | Stable `series ID + original local date` identity.                                |
| `series_id`     | text | Parent `calendar_events.id`, deleted with the series.                             |
| `original_date` | text | Local date generated by the parent rule before any move.                          |
| `status`        | text | `modified` or `cancelled`.                                                        |
| `overrides`     | text | Sparse JSON overrides for title, date/time, duration, notes, color, or reminders. |
| `created_at`    | text | ISO timestamp.                                                                    |
| `updated_at`    | text | ISO timestamp.                                                                    |

One exception is allowed per series and original date. Occurrences are derived
for a bounded range and are not pre-generated as event rows. A modified
occurrence keeps the original recurrence identity even when its visible date is
moved.

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
| `original_preferred_time`             | text    | Optional Planned soft-time snapshot restored when a decision is reopened.  |
| `original_planned_time_preference`    | text    | Compatibility-only migration 008 snapshot; retained but ignored.           |
| `original_estimated_duration_minutes` | integer | Optional snapshot estimate.                                                |
| `original_reminder_offset_minutes`    | integer | Legacy single-reminder snapshot retained for upgrade compatibility.        |
| `original_reminder_offsets`           | text    | JSON-array reminder snapshot used when a decision is reopened.             |
| `original_reminders`                  | text    | Nullable authoritative reminder snapshot, including explicit date/times.   |
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

### Version 6: `task_functional_core`

`src/database/migrations/006_task_functional_core.ts` adds constrained
`tasks.importance`, nullable `tasks.parent_task_id`, and a parent-task index.
Existing rows receive `normal` importance and no parent while preserving every
other field and task identity.

### Version 7: `execution_multiple_reminders`

`src/database/migrations/007_execution_multiple_reminders.ts` adds nullable
`tasks.started_at` plus JSON reminder arrays on tasks, calendar events, and
Recovery item snapshots. Existing single offsets are copied into one-element
arrays, null offsets become empty arrays, and every other value is preserved.
Any legacy `started` row receives its existing `updated_at` as the best
available factual start timestamp. Legacy reminder columns remain in place so
upgrading an installed APK never requires destructive table replacement.

### Version 8: `planned_time_preferences`

`src/database/migrations/008_planned_time_preferences.ts` remains in migration
history so databases upgraded by the reverted release and fresh installations
share one forward-only schema version. It retains nullable
`tasks.planned_time_preference` and the defaulted Recovery snapshot column
`recovery_items.original_planned_time_preference`. Current repositories, types,
validation, scheduling, and UI deliberately ignore both compatibility fields;
task planning remains derived only as Flexible, Planned, or Scheduled.

### Version 9: `task_preferred_deadline_times`

`src/database/migrations/009_task_preferred_deadline_times.ts` adds nullable
`tasks.preferred_time`, nullable `tasks.deadline_time`, and nullable
`recovery_items.original_preferred_time`. Existing rows receive `null` for all
three fields, so task identity, execution history, reminders, scheduling,
Recovery, Recap, event, and settings data remain unchanged. Migration 8 remains
applied and its compatibility-only fields remain present but unused.

### Version 10: `independent_reminders`

`src/database/migrations/010_independent_reminders.ts` adds nullable JSON
`tasks.reminders`, `calendar_events.reminders`, and
`recovery_items.original_reminders` columns. It does not rewrite existing rows.
Readers fall back to the version 7 relative-offset arrays until a record is next
written normally. New writes store the authoritative relative-or-absolute
reminder array and retain the relative offsets as a compatibility projection.
Migrations 8 and 9 remain applied and unchanged.

### Daily Recap Foundation

No migration is required. Recap derives its view from the existing nullable
`tasks.completed_at`, calendar-event, and Recovery session/item records. It
does not persist duplicate daily summary rows.

### Calendar Color And Recurrence Migration

SQLite migration 11 adds `tasks.color`, `calendar_events.color`, nullable
`calendar_events.recurrence_rule`, and `calendar_event_exceptions`. Existing
tasks and events receive `neutral`; existing events remain non-recurring. The
migration is additive and does not rewrite or delete Tasks, Events, Recovery,
Recap source records, Settings, reminders, completion history, or scheduling
data. Migrations 8, 9, and 10 remain unchanged and forward-only.

## Web Persistence

The web build uses IndexedDB database version 11. It has:

- `tasks`, keyed by task ID with `scheduledDate`, `updatedAt`, and `parentTaskId`
  indexes.
- `calendarEvents`, keyed by event ID with `date` and `updatedAt` indexes.
- `calendarEventExceptions`, keyed by exception ID with `seriesId` and
  `originalDate` indexes.
- `recoverySessions`, keyed by session ID with `status` and `completedAt` indexes.
- `recoveryItems`, keyed by item ID with `sessionId` and `status` indexes.
- `appSettings`, keyed by setting key.

Version 2 preserves the existing version 1 task store and adds the event store.
Version 3 preserves both stores and adds recovery storage. Version 4 preserves
all existing stores and adds `appSettings`. Version 5 keeps those stores and
introduces the scheduling task shape without rewriting records. Version 6 adds
the parent-task index without rewriting records. Version 7 upgrades legacy
single reminder fields to arrays and adds nullable `startedAt`. Older task,
event, and Recovery item records also retain fallback readers, so a record that
has not yet been rewritten still produces an empty or one-element reminder
array safely. Version 8 is retained as a compatibility marker so browsers that
already reached version 8 never receive a prohibited downgrade request. The
current app performs no planned-time-preference product migration and ignores
any former `plannedTimePreference` record fields while preserving records on
open. Version 9 advances the database version without rewriting records. Its
readers treat missing `preferredTime`, `deadlineTime`, and Recovery
`originalPreferredTime` fields as `null`; records receive these values on their
next ordinary domain write. Version 10 advances storage without rewriting
records. Missing `reminders` and `originalReminders` fields fall back to the
version 7 relative-offset arrays; ordinary writes add the authoritative shared
reminder shape. Existing version 8 and 9 databases therefore open forward and
retain all records. Version 11 adds the exception store without rewriting
existing records. Readers default missing task/event colors to `neutral` and a
missing event recurrence to `null`, so version 10 databases retain every record
while opening forward. Older task records without
`estimatedDurationMinutes` deserialize with a `null` estimate, and records
without `deadlineDate` receive a `null` deadline. Older task records without
`importance` receive `normal`, records without `parentTaskId` receive `null`,
and records that omit `completedAt` deserialize with a `null` completion time
and are not assigned to a historical Recap date. Stored records are validated
when read.

Browser data is local to the browser profile and application origin. It remains
after refreshes and ordinary browser restarts, but private browsing, storage
pressure, policy restrictions, or clearing site data can remove it. Browser and
native data are intentionally separate.

## Deferred Data Work

Time zones, all-day events, external calendar identifiers, advanced notification policy,
quiet hours, default reminders, arbitrary relative reminder offsets, day plans,
recovery analytics, multi-level projects, partial-progress measurement,
earliest-start constraints, recurring preferred work periods, soft scheduler
ranking around a task's exact preferred time, energy requirements, import/export,
accounts, and cloud
synchronization are not part of this foundation.

Cloud synchronization remains unapproved. A future design must explicitly
address privacy, authentication, conflict resolution, offline reconciliation,
and migration from both local stores.

# Data Model

## Current Implementation

The first build implements local SQLite tables for migrations and tasks.

### `schema_migrations`

| Column       | Type    | Notes                                              |
| ------------ | ------- | -------------------------------------------------- |
| `version`    | integer | Primary key migration version.                     |
| `name`       | text    | Human-readable migration name.                     |
| `applied_at` | text    | ISO timestamp for when the migration was recorded. |

### `tasks`

| Column           | Type | Notes                                                         |
| ---------------- | ---- | ------------------------------------------------------------- |
| `id`             | text | Unique task ID.                                               |
| `title`          | text | Required trimmed title.                                       |
| `description`    | text | Optional trimmed description.                                 |
| `status`         | text | Current implemented values are `not_started` and `completed`. |
| `scheduled_date` | text | Local date string in `YYYY-MM-DD` format.                     |
| `scheduled_time` | text | Optional local time string in `HH:MM` format.                 |
| `created_at`     | text | ISO timestamp.                                                |
| `updated_at`     | text | ISO timestamp.                                                |
| `completed_at`   | text | Optional ISO timestamp set on completion.                     |
| `deleted_at`     | text | Optional ISO timestamp reserved for future soft deletion.     |

The status constraint also reserves future values so later migrations do not
need to rewrite existing rows only to recognize planned states:

- `started`
- `partially_completed`
- `intentionally_skipped`
- `rescheduled`
- `recovery_queue`
- `no_longer_necessary`

## Current Migration

`src/database/migrations/001_create_tasks.ts` creates the `tasks` table and
indexes scheduled date and update timestamp access patterns.

## Future Entities

### User Preferences

Local settings such as default day start, planning style, notification
preferences, accessibility preferences, and recovery defaults.

### Tasks

Long-lived work items that may later support steps, estimates, priority, energy
level, recurrence, and recovery behavior.

### Task Steps

Smaller units within a task. Steps should preserve partial progress and support
completion history.

### Fixed Calendar Events

Appointments or commitments that must not be moved automatically.

### Day Plans

The planned set of tasks, priorities, fixed events, and flexible work for a
specific local day.

### Day States

Daily context such as available energy, recovery mode status, and planning
capacity.

### Completion Events

Append-only records of completed or partially completed work used for factual
recaps.

### Recovery Queue

Flexible unfinished work moved into a reviewable queue when Recovery Mode is
activated.

### Notification Records

Local records for reminders, pauses, and notification delivery state. Advanced
notifications are deferred.

# Data Model

## Shared Task Model

All platforms use the `Task` type in `src/types/task.ts` and the same
`TaskRepository` behavior. Task validation, creation, completion, completion
undo, ordering, and non-deleted filtering are platform-neutral.

The repository depends on a `TaskStorage` contract. Native builds provide a SQL
adapter and web builds provide an IndexedDB adapter.

## Native Persistence

Android and future iOS builds use Expo SQLite with versioned SQL migrations.
Native persistence behavior is unchanged by the web prototype.

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

## Web Persistence

The web build uses the browser's IndexedDB API. Database version 1 creates a
`tasks` object store keyed by task ID and indexes `scheduledDate` and
`updatedAt`. Records use the same fields and string/null representations as the
shared `Task` type.

Stored records are validated when they are read. Invalid or unavailable browser
storage is reported through the existing repository and provider error states;
screens do not access IndexedDB directly.

Browser data is local to the browser profile and application origin. It remains
after refreshes and ordinary browser restarts, but private browsing, storage
pressure, policy restrictions, or clearing site data can remove it. Browser and
native task data are intentionally separate in this phase.

## Migration Limitations

SQL migrations apply only to native SQLite. IndexedDB has its own database
version and upgrade callback, so any future task schema change must update and
test both migration paths. There is no automatic migration between native and
web storage and no import/export flow yet.

## Future Cloud Sync Considerations

Cloud synchronization is not approved or implemented. If it is considered in a
future assignment, the shared task IDs and timestamps can support a sync
protocol, but conflict resolution, deletion history, privacy, authentication,
offline reconciliation, and migration from each local store require explicit
product and technical decisions first.

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

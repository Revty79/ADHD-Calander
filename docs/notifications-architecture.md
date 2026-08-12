# Notifications Architecture

## Purpose

Reminders help users notice a plan without adding pressure or shame. A task or
fixed event can store zero to five local reminder choices. This does not add
cloud push, urgency scoring, overdue alerts, repeated nagging, or scheduling
intelligence.

## Domain Intent

`Task.reminders` and `CalendarEvent.reminders` use one shared union:

- `relative`: a supported number of minutes before an exact task or event start.
- `absolute`: one explicit local `YYYY-MM-DD` date and `HH:MM` time independent
  from item placement.

Supported relative offsets are:

- `0`: at the scheduled time
- `5`: 5 minutes before
- `10`: 10 minutes before, retained for legacy choices
- `15`: 15 minutes before
- `30`: 30 minutes before, retained for legacy choices
- `60`: 1 hour before
- `1440`: 1 day before

The shared editor presents understandable controls and limits each item to five
choices. Scheduled tasks and fixed events expose relative choices. Every task
and fixed event can add, edit, and remove explicit local reminder date/times.
Adding a reminder never changes Flexible, Planned, or Scheduled state.

Reminder arrays remain stored when a task changes placement, completes, is
removed, is delegated, or is broken down. This prevents silent loss. A relative
choice needs an exact item start. An explicit choice does not. Android schedules
either only while the item is active, the trigger is in the future, reminders
are enabled, and native permission is granted.

Date and time components construct a local `Date`; date-only strings are never
parsed through UTC. A past offset is skipped rather than scheduled late, but
its stored choice remains visible. Re-enabling reminders or rescheduling the
item reconciles every newly valid trigger.

## Adapter Boundary

`ReminderService` translates repository state into notification operations. It
depends on `SettingsRepository`, task and event storage, a platform-neutral
`NotificationAdapter`, and a clock. `ExpoNotificationAdapter` schedules native
local notifications. `UnsupportedNotificationAdapter` is used on web and never
requests browser permission or schedules fake delivery.

Each reminder has a deterministic, distinct identifier:

- `adhd-calendar-task-{taskId}-{offset}`
- `adhd-calendar-event-{eventId}-{offset}`
- `adhd-calendar-task-{taskId}-absolute-{date}-{time}`
- `adhd-calendar-event-{eventId}-absolute-{date}-{time}`

Recurring relative event identifiers use the stable occurrence ID (`series ID

- original local date`) in the event-ID position. A series-level explicit
  reminder keeps the series ID and is deduplicated across derived occurrences.

Before synchronizing one item, the service cancels every supported offset
identity, the legacy single identity, and explicit identities from both the
previous and updated record. It then schedules only valid future requests. This
removes stale notifications after moving, editing, or removing one reminder
without requiring a notification-ID table. Startup reconciliation cancels the
full app schedule and rebuilds it from local intent.

Adapter failures are logged and do not roll back task, event, completion, or
Recovery persistence.

## Permission Behavior

- Permission is never requested at startup.
- Turning reminders on requests permission only when status is undetermined.
- Denial leaves planning fully usable and stores the master setting as off.
- Settings offers the system-settings route after denial without nagging.
- Turning reminders off cancels every scheduled local notification while
  preserving item choices.

Notification copy uses stored titles and factual timing. It avoids overdue
language, blame, exclamation points, productivity judgment, and invented
urgency.

## Task Synchronization

- Create/edit/reschedule: persist the reminder array, cancel every old identity,
  then schedule all valid future triggers.
- Start/Pause: keep the task active and do not alter reminder intent.
- Complete/remove/resolve: preserve reminder choices but cancel pending native
  notifications because the task is no longer active.
- Undo completion/restore/reopen: the task becomes active again; synchronization
  schedules only choices whose trigger remains in the future.
- Flexible or Planned transition: preserve all choices. Explicit reminders can
  remain active; relative choices become inactive until an exact time exists.

Accepting a scheduling suggestion continues to use `TaskRepository.scheduleTask`.
The existing task identity and reminder array are preserved, then every trigger
is rebuilt against the confirmed local date/time.

## Event Synchronization

Fixed-event creation and editing persist and schedule zero to five reminders.
Non-recurring events reconcile directly. Recurring events expand from today
through 90 days ahead and calculate each relative reminder from that
occurrence's local start. Modified exceptions use their overridden date, time,
and reminder list; cancelled exceptions schedule nothing. Series edits cancel
both prior and current horizon identifiers before rebuilding, and startup still
cancels the complete app schedule before reconciliation. The finite horizon
prevents an endless rule from producing endless OS requests.

## Recovery Integration

Recovery items snapshot `originalReminders`. Recovery decisions preserve
the original task's choices while active notification delivery changes with the
task state:

- Keep unscheduled and date-only Reschedule keep choices; explicit future
  reminders can still deliver while relative reminders remain inactive.
- Timed Reschedule rebuilds every valid trigger.
- Break Down, Delegate, and Remove preserve original history but cancel active
  notifications; new smaller tasks begin without reminder choices.
- Reopen restores the original reminder snapshot and resynchronizes it.

Every task mutation is persisted before synchronization. Fixed events never
enter Recovery and are never moved.

## Platform And Release Limits

Android is the current notification-delivery target. Web saves and edits the
same reminder intent but reports delivery as unsupported and never requests
browser notification permission. This phase does not request Android
exact-alarm access.

Automated tests verify intent persistence, distinct identifiers, stale
cancellation, completion/removal cancellation, rescheduling, Recovery, and
legacy upgrades. Android permission, channel behavior, delivery timing, and OS
cancellation still require a physical-device preview-build test.

## Deliberately Deferred

- Quiet hours and default offsets
- Arbitrary relative reminder offsets
- Snooze, notification actions, badges, sounds, and urgency tiers
- Location reminders and browser notifications
- Exact-alarm policy work
- Cloud push, accounts, analytics, and cross-device sync

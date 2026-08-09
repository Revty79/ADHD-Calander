# Notifications Architecture

## Purpose

Reminders help users notice a plan without adding pressure or shame. A task or
fixed event can store zero to five local reminder choices. This does not add
cloud push, urgency scoring, overdue alerts, repeated nagging, or scheduling
intelligence.

## Domain Intent

`Task.reminderOffsets` and `CalendarEvent.reminderOffsets` store unique arrays.
Supported offsets are:

- `0`: at the scheduled time
- `10`: 10 minutes before, retained for legacy choices
- `15`: 15 minutes before
- `30`: 30 minutes before, retained for legacy choices
- `60`: 1 hour before
- `1440`: 1 day before

The UI presents understandable check controls and limits each item to five
choices. Offset arrays remain stored when a task becomes Flexible, Planned,
completed, removed, delegated, or broken down. This prevents silent loss. A
choice schedules only while the item is active, has an exact local date/time,
the trigger is still in the future, reminders are enabled, and native
permission is granted.

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

Before synchronizing one item, the service cancels every supported offset
identity plus the legacy single identity. It then schedules only valid future
requests. This removes stale notifications after changing a time or deselecting
an offset without requiring a notification-ID table. Startup reconciliation
cancels the full app schedule and rebuilds it from local intent.

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
  then schedule all valid future triggers. Android scheduling assistance exposes
  the same up-to-five selection before confirming a generated or exact time.
- Start/Pause: keep the task active and do not alter reminder intent.
- Complete/remove/resolve: preserve reminder choices but cancel pending native
  notifications because the task is no longer active.
- Undo completion/restore/reopen: the task becomes active again; synchronization
  schedules only choices whose trigger remains in the future.
- Flexible or Planned transition: preserve choices, cancel timed notifications,
  and report that choices are inactive until an exact time exists.

Accepting a scheduling suggestion continues to use `TaskRepository.scheduleTask`.
The existing task identity and reminder array are preserved, then every trigger
is rebuilt against the confirmed local date/time.

## Event Synchronization

Fixed-event creation persists and schedules zero to five reminders. General
event editing is not implemented, so the app does not display a fake event
reminder editor. Editing/removing events and their reminders remains part of a
later Calendar functional-hardening phase.

## Recovery Integration

Recovery items snapshot `originalReminderOffsets`. Recovery decisions preserve
the original task's choices while active notification delivery changes with the
task state:

- Keep unscheduled and date-only Reschedule keep choices but schedule nothing.
- Timed Reschedule rebuilds every valid trigger.
- Break Down, Delegate, and Remove preserve original history but cancel active
  notifications; new smaller tasks begin without reminder choices.
- Reopen restores the original reminder snapshot and resynchronizes it.

Every task mutation is persisted before synchronization. Fixed events never
enter Recovery and are never moved.

## Platform And Release Limits

Android is the current notification target. Web reports reminders as
unsupported and offers no controls that imply browser delivery. This phase does
not request Android exact-alarm access.

Automated tests verify intent persistence, distinct identifiers, stale
cancellation, completion/removal cancellation, rescheduling, Recovery, and
legacy upgrades. Android permission, channel behavior, delivery timing, and OS
cancellation still require a physical-device preview-build test.

## Deliberately Deferred

- Quiet hours and default offsets
- Arbitrary custom reminder offsets
- Event reminder editing after creation
- Recurring reminders, snooze, notification actions, badges, sounds, and
  urgency tiers
- Location reminders and browser notifications
- Exact-alarm policy work
- Cloud push, accounts, analytics, and cross-device sync

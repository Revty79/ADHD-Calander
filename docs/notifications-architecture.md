# Notifications Architecture

## Purpose

Reminders help users notice a plan without adding pressure or shame. This phase
adds one optional local reminder per scheduled task or fixed event. It does not
add scheduling intelligence, cloud push, urgency scoring, overdue alerts, or
repeated nagging.

## Domain Intent

`Task.reminderOffsetMinutes` and `CalendarEvent.reminderOffsetMinutes` store
nullable reminder intent. Supported offsets are:

- `0`: at the scheduled time
- `10`: 10 minutes before
- `30`: 30 minutes before
- `60`: 1 hour before

A reminder requires a valid local date and wall-clock time, and its trigger must
be in the future when the item is created. Date and time components are used to
construct a local `Date`; date-only strings are never parsed through UTC.

Reminder intent is stored even while the master setting is off. This lets the
user turn reminders back on without losing item choices. Disabling reminders
cancels all currently scheduled notifications. Re-enabling reconciles all
eligible future task and event reminders from local storage.

## Adapter Boundary

`ReminderService` translates repository state into notification operations. It
depends on:

- `SettingsRepository`
- `TaskStorage` and `CalendarEventStorage`
- the platform-neutral `NotificationAdapter`
- a clock for future-trigger checks

`ExpoNotificationAdapter` is the native implementation. It creates the Android
`planning-reminders` channel, requests permission only after an explicit enable
action, schedules local date-trigger notifications, and cancels by deterministic
identifier. `UnsupportedNotificationAdapter` is used on web and performs no
notification scheduling.

Identifiers are deterministic:

- `adhd-calendar-task-{taskId}`
- `adhd-calendar-event-{eventId}`

The service cancels an item's identifier before any reschedule, preventing
duplicates without a second notification-ID table. Startup reconciliation also
cancels and rebuilds the future schedule from stored intent. Adapter failures
are logged and do not prevent task, event, completion, or Recovery persistence.

## Permission Behavior

- Permission is never requested at startup.
- Turning reminders on requests permission only when status is undetermined.
- Denial leaves the app fully usable and stores the master setting as off.
- Settings explains the state and offers the system-settings route after denial.
- The app does not repeatedly prompt after denial.
- Turning reminders off cancels every scheduled local reminder.

Notification copy uses stored titles and factual timing, such as a planned time
or minutes until an event. It avoids overdue language, blame, exclamation points,
productivity judgment, and invented urgency.

## Task And Event Synchronization

- Create: store optional reminder intent, then synchronize its deterministic ID.
- Complete task: clear reminder intent and cancel the future notification.
- Undo completion: restore active status but do not invent or silently restore a
  reminder the user did not explicitly reselect.
- Fixed event creation: store and synchronize one optional reminder.
- Master disabled: preserve intent but schedule nothing.
- Startup/enable: schedule only active future tasks and future events.

General task and event editing is not yet implemented. When editing is added, it
must use the same cancel-before-reschedule service path.

Accepting a scheduling suggestion uses `TaskRepository.scheduleTask` rather
than writing storage directly. The repository preserves reminder intent when
the recalculated trigger remains in the future, clears intent when it cannot be
valid, persists the task, and then synchronizes the deterministic notification
identifier. Candidate generation itself never calls notification APIs.

## Recovery Integration

Recovery items snapshot the original reminder offset so a reversible decision
can restore it while the session remains active.

- Keep unscheduled clears date, time, and reminder.
- Reschedule keeps the reminder only when the user supplies a new time; the
  reminder is recalculated from the new local date and time.
- Break Down clears the original reminder and creates children without reminders.
- Delegate clears the personal reminder.
- Remove clears the active reminder.
- Reopen restores the original task reminder snapshot and retires generated
  children without reminders.

Every task mutation is persisted before its reminder is synchronized. Fixed
events are not part of Recovery and are never moved.

## Platform And Release Limits

The Android app is the primary notification target. `expo-notifications` and its
Expo config plugin are installed. Web intentionally reports reminders as
unsupported and requests no browser permission.

Local notifications can be exercised in Expo Go, but Expo Go is not proof of a
production Android build. Delivery timing is subject to Android scheduling and
battery behavior. This phase does not request Android exact-alarm permission;
whether the release needs that policy-sensitive capability must be reviewed in
the Google Play preparation track. Permission, channel behavior, delivery, and
cancellation still require physical-device or emulator verification in a
development/release build.

## Deliberately Deferred

- Quiet hours, because fixed-event behavior and boundary cases need product rules
- Default reminder offsets
- Multiple reminders per item
- Event/task reminder editing UI
- Recurring reminder rules
- Snooze, notification actions, badges, sounds, and urgency tiers
- Location reminders
- Browser notifications
- Cloud push, Firebase messaging, accounts, analytics, and cross-device sync

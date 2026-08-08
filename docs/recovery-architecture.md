# Recovery Architecture

## Purpose

Recovery Mode answers: “My day no longer matches the plan. What happens to the
unfinished work?” It replaces passive overdue accumulation with explicit,
one-task-at-a-time choices. Language stays factual and every scheduling change
comes from a user action.

## Session Lifecycle

`RecoveryRepository.startSession(sourceDate)` validates a local `YYYY-MM-DD`
date and returns the existing active session if one already exists. Otherwise,
it snapshots active unfinished tasks scheduled for that date. Completed,
delegated, removed, and broken-down tasks are excluded.

Only one session can be active. Each item begins `pending`. A final decision
changes it to `resolved`; Decide Later stores `skip` but intentionally leaves it
pending. Progress is the factual resolved-item count, such as “2 of 5 tasks
decided.” The user explicitly finishes after all items are resolved. Completion
sets the session status and timestamp; completed sessions are retained.

An active session can be left and resumed. A resolved item can be reopened
before session completion. Reopening restores the original task status and
schedule, preserving any recorded partial state. If a
breakdown created smaller tasks, reopening marks those generated tasks removed
before restoring the original. Reopening is blocked if the original or a
generated task has since been completed, because silently undoing recorded work
would lose meaning.

## Recovery Decisions

- `keep`: keeps the original task active and clears its date and time.
- `reschedule`: updates the original task identity with the explicitly chosen
  date and optional time.
- `break_down`: creates two or more uniquely titled, unscheduled tasks and marks
  the original `broken_down`.
- `delegate`: marks the original `delegated` and stores an optional note on the
  recovery item. No message is sent.
- `remove`: marks the original `removed`; the record is not deleted.
- `skip`: records that the item was deferred, while leaving it pending and
  reviewable.

Keeping and breaking down work never assigns tomorrow or any other date.
Reschedule is the only recovery decision that adds a new date, and that date is
always entered explicitly.

## Fixed Events And Tasks

Recovery depends on task and recovery storage only. It does not query
`CalendarEventRepository`, so fixed appointments cannot enter the queue or be
moved by a recovery decision. Past fixed events remain calendar facts.

Today and Calendar continue to distinguish fixed events, timed planned tasks,
untimed flexible tasks, and completed tasks. Delegated, removed, and broken-down
original tasks remain available as history in Tasks but are excluded from active
Today and Calendar work.

## Persistence

Native SQLite migration 3 adds `recovery_sessions` and `recovery_items`, and
rebuilds the task status constraint while preserving rows. A partial unique
index enforces one active session. Recovery item rows snapshot the original
title, date, time, and estimate and store decision details plus generated task
IDs. Task mutations and the matching recovery-item update run in one SQLite
transaction.

IndexedDB version 3 adds `recoverySessions` and `recoveryItems`. Session status
and item session ID are indexed. Browser writes update tasks and recovery items
in one transaction, and session creation checks for an existing active session.
Stored values are validated when read.

SQLite migration 4 and IndexedDB version 4 add the original reminder offset to
the Recovery item snapshot. Keep, Break Down, Delegate, and Remove clear the
original task reminder. Reschedule retains it only when the user gives the task
a new time, so the trigger is rebuilt from the new local schedule. Child tasks
start without reminders. Reopening restores the original reminder snapshot
along with the task schedule. Each persisted mutation is then synchronized
through `ReminderService`; fixed events remain outside Recovery.

Daily Recap reads every active or completed Recovery session whose `sourceDate`
matches the selected recap date. Final decisions are summarized as plan
adjustments, while pending and Decide Later items remain waiting for a decision.
Recovery decisions never become completed-task accomplishments. Because Recap
is derived, reopening an active decision immediately changes the next summary.

## Deliberately Deferred

- A direct optional "Help me find a time" action inside an active Recovery
  reschedule decision. The shared scheduling service can support it later, but
  the current supported entry point is Tasks.
- Automatic scheduling, best-time placement, or tomorrow rollover
- Capacity scoring and essential-task selection
- Full task hierarchy or project management
- Sharing, contacts, or delegate messaging
- Quiet hours, reminder pausing, and advanced notification actions
- Recurring work and external calendars
- Recovery analytics, streaks, and performance scoring
- Accounts, cloud sync, and AI

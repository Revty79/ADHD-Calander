# Recovery Mode

Recovery Mode is a functional first foundation for handling unfinished work
without creating an alarming overdue pile. The detailed technical design is in
`docs/recovery-architecture.md`.

## Current Behavior

- Start a recovery session manually for a local date from Today or Recovery.
- Review unfinished active tasks one at a time.
- Keep a task active but unscheduled.
- Explicitly reschedule a task to a chosen date and optional time.
- Break a task into two or more smaller unscheduled tasks.
- Mark a task delegated with an optional local note.
- Remove a task from active planning while retaining history.
- Decide later without resolving or hiding the item.
- Leave and resume an active session with saved progress.
- Change a resolved decision while the session remains active.
- Finish only after every item has a resolved decision.

Fixed appointments are never placed in a recovery session. Completed and
already resolved tasks are excluded. No action automatically schedules work for
tomorrow.

## Deliberately Deferred

- Automatic task placement or workload optimization
- Reminder pausing
- Essential-task classification
- Recurring work
- Messaging or contact integration for delegation
- Completed-session history browsing or analytics
- AI assistance

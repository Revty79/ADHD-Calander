# Scheduling Architecture

## Purpose And Safety Boundary

Scheduling assistance answers "Where could this flexible task reasonably fit?"
It does not fill a calendar, move fixed commitments, infer energy, or mutate a
task during search. Calendar whitespace is treated as unknown capacity. The
user sees no more than three suggestions, chooses one, and confirms it before
the existing task changes.

The domain distinction remains explicit:

- `CalendarEvent` is a fixed commitment and is never moved by the scheduler.
- A Scheduled task has a date and exact start time and blocks that
  interval while active.
- A Planned task has a date and no exact start time. It may carry an Anytime,
  Morning, Afternoon, or Evening preference but does not claim an interval.
- A Flexible task has no date, exact time, or time-of-day preference.

## Boundaries

`generateSchedulingSuggestions` in `src/features/scheduling/scheduler.ts` is a
pure deterministic function. It receives one task, current task/event records,
planning preferences, a local start date, a bounded horizon, and the current
clock. It returns candidate data and never accesses SQLite, IndexedDB,
navigation, Expo Notifications, or React state.

`SchedulingService` is the workflow boundary. It gathers repositories and
settings, defaults to a seven-day search, and supports a one-time extension to
14 days. On acceptance it runs the search again, verifies the exact date,
start, end, and duration are still offered, then calls
`TaskRepository.scheduleTask`. A changed or occupied opening is rejected with a
calm refresh message.

## Candidate-Window Rules

1. Search local dates from today, or from a future Planned date when one exists,
   through the bounded horizon. Never suggest a date before that explicit
   Planned date. Stop at the task's deadline when one exists.
2. Search only between the configured planning-day start and end. On today,
   search begins after the current local time rounded to the next 15-minute
   increment.
3. A task needs a positive whole-minute estimate. Tasks without estimates remain
   valid but receive a `needs_duration` result until the user chooses one.
4. Fixed events block their known interval plus the configured transition buffer
   before and after. An unknown-duration fixed event blocks from its start
   through planning-day end.
5. Active timed tasks block their known interval. They do not receive the
   fixed-event transition buffer. An unknown-duration timed task blocks from its
   start through planning-day end.
6. Untimed dated tasks do not block exact windows. Completed, delegated,
   removed, and broken-down tasks do not block active planning.
7. The estimate must fit fully in a free gap. Exact fits are valid; a task that
   exceeds a buffered gap by one minute is not.
8. Known scheduled task minutes plus the candidate must not exceed the configured
   daily suggested-task limit. There is no override that silently breaks it.
9. Candidate starts use 15-minute increments. The engine produces the earliest
   fitting start in each free gap and, when different, the earliest fitting
   start inside the task's preferred period. It does not enumerate every
   possible increment as a productivity opportunity.

Planned time preferences use deterministic local wall-clock ranges:

- Morning: 06:00 inclusive to 12:00 exclusive.
- Afternoon: 12:00 inclusive to 17:00 exclusive.
- Evening: 17:00 inclusive to 21:00 exclusive.
- Anytime: no preferred subrange.

The full task interval must fit inside the preferred range to count as a match.
Ranges are intersected with configured planning hours. If no preferred fit is
available, valid non-preferred candidates remain available; the preference is
never a hard constraint.

The default preferences are 08:00-20:00 planning hours, 15 minutes around fixed
events, and 180 maximum suggested task minutes per day. These are planning
defaults, not medical or productivity facts.

## Daily Load And Ranking

Daily load is factual data:

- fixed commitment count;
- known fixed-event minutes;
- active timed-task count;
- known timed-task minutes; and
- total known scheduled minutes.

Unknown durations contribute zero to reported minutes even when they block a
window. This avoids inventing a duration.

Candidates are sorted deterministically by:

1. lower two-hour total-scheduled-time band;
2. preferred-period match before fallback within that band;
3. earlier local date;
4. lower exact known scheduled minutes; and
5. earlier start time.

Selection first takes at most one candidate from each date, then fills remaining
positions from the sorted list until three are selected. This allows a later,
meaningfully lower-load day to appear before a substantially busier first day
without exposing an opaque productivity score. Explanations state only the
rules actually used: full fit, planning hours, fixed-event buffer, deadline,
preferred-period match or fallback, and known scheduled time.

## Confirmation And Persistence

Tasks exposes "Help me schedule" for active tasks without a start time. The
workflow offers practical estimates of 10, 15, 30, 45, 60, 90, and 120 minutes,
including temporary estimates for tasks that did not store one at creation.
Selecting a card does not persist anything. A separate Confirm schedule action
is required.

The same screen offers a direct exact date/time path for a user who already
knows the desired placement. The user reviews and confirms that placement before
mutation. Exact placement uses `TaskRepository.scheduleTask`, keeps the task
identity, preserves the soft preference as historical editing intent, and
classifies the result as Scheduled rather than Planned.

Acceptance preserves task ID, title, description, status, deadline, and record
history. It updates the task's local scheduled date/time and stores the selected
estimate when needed. It never creates a `CalendarEvent` or duplicate task.
Calendar and Today observe the same task record through their existing refresh
flows.

## Reminder Integration

`TaskRepository.scheduleTask` recalculates reminder validity against the accepted
local date/time. The Android scheduling screen can replace the task's reminder
selection with up to five explicit choices while confirming a suggestion or
exact time; otherwise every stored choice is preserved. The existing
`ReminderSynchronizer` cancels stale request identifiers and schedules only
offsets whose new trigger remains in the future; a past trigger does not erase
the user's saved choice. Search and ranking never schedule or cancel
notifications.

## Recovery And Local Dates

Recovery continues to require an explicit task-by-task decision and never calls
the scheduler automatically. A direct optional scheduling action after
Reschedule is deferred because it would need a deliberate reversible-state UX;
Tasks is the current entry point.

Candidate dates remain validated `YYYY-MM-DD` strings and times remain `HH:MM`
local wall-clock strings. Date iteration uses local date components. No UTC
conversion is introduced for schedule placement.

## Deliberately Deferred

- AI, LLM, natural-language scheduling, and opaque optimization
- Automatic scheduling or rescheduling
- Predictive energy or mental-state inference
- Earliest-start task fields
- Energy requirements and user energy profiles
- Weekly availability editors and recurring availability
- Direct Recovery Mode scheduling entry point
- External calendars, cloud sync, accounts, and analytics

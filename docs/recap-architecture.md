# Recap Architecture

## Purpose

Daily Recap answers: “What did I actually get done on this local date?” It
makes recorded accomplishments prominent, then provides calm context about
fixed calendar commitments, Recovery decisions, and work that remains active.
It does not grade the day or turn unfinished work into a warning.

## Derived Data Boundary

`DailyRecapRepository` is a read-only domain service composed from
`TaskRepository`, `CalendarEventRepository`, and `RecoveryRepository`. It loads
existing local records and derives a `DailyRecap` in memory. Screens do not read
SQLite or IndexedDB directly.

There is no recap table, object store, or cache. A recap remains accurate after
a completion is undone or an active Recovery decision is reopened because the
summary is rebuilt from the current source records each time it is viewed.

## Accomplishments

A task is an accomplishment for the selected date only when:

- its current status is `completed`;
- it has a valid `completedAt` ISO timestamp; and
- that instant falls on the selected date in the device's current local time.

The task's `scheduledDate` does not determine its accomplishment date. A task
scheduled yesterday and completed today appears in today's recap. A task
scheduled today but left open does not appear under Accomplished. A completed
legacy record with no known completion timestamp remains readable but is not
assigned invented history.

Completing a task records the clock instant. Undoing completion clears
`completedAt`. Completing the task again records the new instant. Known task
estimates may be totaled as factual context; unknown estimates contribute zero.

## Fixed Commitments

Fixed `CalendarEvent` records for the selected local date appear separately
under “On your calendar.” Recap reports that they were calendar commitments. It
does not claim attendance or completion because the product does not record
either fact.

## Recovery Integration

Recovery sessions are selected by their `sourceDate`, including active and
completed sessions. Resolved `keep`, `reschedule`, `break_down`, `delegate`, and
`remove` decisions are counted as plan adjustments. A pending item, including
Decide Later, is reported as waiting for a decision and is not counted as a
final adjustment.

Delegated, removed, rescheduled, and broken-down tasks never count as completed
tasks. An active task kept unscheduled remains visible under Still open. Pending
Recovery items and other active tasks still scheduled for the selected date are
also identifiable there. Entries are deduplicated by task ID.

## Encouragement And Scores

Encouragement is selected from a small deterministic rule set based only on
recorded completions and final Recovery decisions. No AI service is used. The
summary has no productivity percentage, grade, streak, performance rating,
badge, chart, or success score. Counts explain stored facts rather than judging
the user.

## Local Dates And Persistence

The selected recap date is a validated `YYYY-MM-DD` local date. Calendar dates
remain date-only strings and never pass through UTC. `completedAt` is an ISO
instant because completion is a point in time; Recap converts that instant to a
local date with local year, month, and day accessors before matching it.

Native data remains in SQLite and web data remains in IndexedDB. The existing
task schema already includes nullable `completed_at`, so this phase requires no
SQL migration or IndexedDB version change. Browser deserialization treats a
legacy task record that omits `completedAt` as `null`.

## Platform Presentation

Native uses a stacked, touch-friendly recap with accomplishments first. Web
uses a wide accomplishment area and smaller calendar/Recovery context panels,
then stacks them at narrower widths. Both default to today and support previous
dates with day controls and a simple date field. Future dates are not offered
as daily recaps.

Today contains only a small link to today's recap; it does not duplicate the
end-of-day review.

## Deferred Features

- Partial-progress entry and measurement. The task model reserves
  `partially_completed`, but there is no factual progress amount or user action
  to summarize yet. Adding percentages solely for Recap would create an
  unapproved project-tracking system.
- Weekly or monthly analytics, charts, trends, and comparisons.
- Stored recap snapshots or editable journal notes.
- Attendance tracking for fixed events.
- AI-generated summaries or encouragement.
- Cloud sync, sharing, and cross-device history.

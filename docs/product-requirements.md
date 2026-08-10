# Product Requirements

## Product Vision

ADHD Calendar is a recovery-first planning app for adults with ADHD and
executive-function challenges. It should help users plan realistically, recover
when plans break down, and recognize recorded progress without shame.

## Target User

The primary user is an adult who wants practical help choosing, scheduling, and
recovering from daily tasks. They may have fluctuating energy, time blindness,
difficulty breaking work into steps, and a history of tools that become
punitive when plans slip.

## Main User Problem

Traditional task tools often assume that falling behind is a simple motivation
problem. ADHD Calendar assumes the user needs a calmer way to re-plan, protect
important commitments, preserve partial progress, and avoid overloading the next
day.

## Core Cycle

1. Plan a realistic day with a limited number of priorities.
2. Create tasks and, later, break large tasks into smaller steps.
3. Record completed or partially completed work.
4. Adjust the day when energy or available time changes.
5. Enter Recovery Mode when the day falls apart.
6. Reschedule unfinished work without simply pushing everything to tomorrow.
7. Review a factual, encouraging recap based on recorded actions.

## Global Functional Definition Of Done

This acceptance standard applies globally to Today, Tasks, Calendar, Recovery,
Recap, Scheduling, Reminders, Settings, Accessibility, future onboarding,
future monetization, and every future feature.

The existence of a screen, label, button, toggle, route, database column,
repository or service, placeholder UI, or test that can instantiate a feature
is not evidence that the feature is implemented. A feature is implemented only
when a real user can perform the intended action, receives understandable
feedback, sees the correct result on every applicable app surface, and sees a
persistent result survive reload or app restart.

Acceptance and handoff review must exercise the complete user path. Every
handoff must explicitly identify anything that appears functional in the UI but
is not wired to functioning behavior.

## MVP Feature Boundary

The MVP should include local task creation, today planning, completion tracking,
completion undo, basic recovery review, and an end-of-day recap. It should work
offline and avoid unnecessary data collection.

## Current First-Build Scope

The first build includes tab navigation, task and fixed-event creation, Today,
Calendar, Tasks, Recovery, Daily Recap, and Guide views, local SQLite and IndexedDB
persistence, completion, and completion undo. Recap uses actual local
completion dates, keeps fixed commitments factual, and summarizes explicit
Recovery decisions without scoring the day. Recovery supports explicit
task-by-task decisions without automatic next-day scheduling. Settings provides
a local reminder master control, accessibility and privacy guidance, and app
information. Task planning uses human date/time controls with quick local-date
choices instead of requiring formatted strings. Planned tasks may carry an
optional exact preferred time that remains a soft preference, while Scheduled
tasks require an actual start time. Deadlines may have an optional exact local
time; date-only deadlines mean the end of that local day. Tasks can be started,
paused, and completed while keeping planning state separate from execution state.
Every task may carry up to five explicit local reminder date/times without
changing whether it is Flexible, Planned, or Scheduled. Scheduled tasks and
fixed events may also use relative reminders. Android schedules future reminder
delivery when enabled and permitted. Web saves and edits the same reminder
intent while clearly reporting that browser notification delivery is unavailable.
Flexible tasks can request deterministic scheduling suggestions inside local
planning boundaries. The user reviews no more than three factual options and
must choose and confirm one before the existing task schedule changes.
Calendar gives Add event and Add task comparable primary discoverability. A
consistent Plans changed? action opens a confirmation step, then starts or
resumes the one active Recovery session without automatic task changes.

## Explicit Non-MVP Features

- Cloud synchronization
- AI task assistance
- External calendar integrations
- Subscription or payment flows
- Advanced notifications, quiet hours, and cloud push
- Automatic schedule optimization or unconfirmed rescheduling
- Automated or AI-assisted Recovery Mode scheduling
- Medical, diagnostic, or therapeutic advice

## Product Success Test

A user can add a task without typing storage-formatted dates, see it on the
correct local day, start and pause it, mark it complete, undo that completion,
deliberately process unfinished work in Recovery Mode, and
review recorded accomplishments for the date they were actually completed.
Closing and reopening the app preserves task, recovery, and derived recap
accuracy without punitive language or alarming overdue treatment.

Optional reminders pass the same success test when enabled: multiple choices
persist, explicit reminder times remain independent from planning state,
relative choices follow an exact item schedule, pending delivery is reconciled
after edits, completion, removal, or a resolving Recovery decision, and reminder
permission never prevents planning.

Scheduling assistance passes when a flexible task with a duration can receive
bounded, non-overlapping local-time suggestions around fixed events and timed
tasks; accepting one preserves task identity and persistence, while declining
leaves the task unchanged.

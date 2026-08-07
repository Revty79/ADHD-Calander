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

## MVP Feature Boundary

The MVP should include local task creation, today planning, completion tracking,
completion undo, basic recovery review, and an end-of-day recap. It should work
offline and avoid unnecessary data collection.

## Current First-Build Scope

The first build includes tab navigation, task and fixed-event creation, Today,
Calendar, Tasks, and Recovery views, local SQLite and IndexedDB persistence,
completion, completion undo, and a placeholder Recap screen. Recovery supports
explicit task-by-task decisions without automatic next-day scheduling.

## Explicit Non-MVP Features

- Cloud synchronization
- AI task assistance
- External calendar integrations
- Subscription or payment flows
- Advanced notifications
- Full scheduling engine
- Automated or AI-assisted Recovery Mode scheduling
- Medical, diagnostic, or therapeutic advice

## Product Success Test

A user can add a task, see it on the correct local day, mark it complete, undo
that completion, and deliberately process unfinished work in Recovery Mode.
Closing and reopening the app preserves task and recovery progress without
punitive language or alarming overdue treatment.

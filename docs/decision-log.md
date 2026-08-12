# Decision Log

## 2026-08-10

### Calendar Color And Recurrence Storage Advances To Version 11

Decision: Store one row per normal event or recurring series, keep recurrence
rules as validated JSON, and store sparse modified/cancelled exceptions by
series ID plus original local date. Derive occurrences only for bounded caller
ranges. Add one shared six-color key to tasks and events. SQLite migration 11 is
additive; IndexedDB advances to 11 and adds only the exception store. Missing
color and recurrence fields read as `neutral` and non-recurring.

Reason: Pre-generating event copies would create unbounded storage and fragile
edit semantics. Stable original-date identity supports one-occurrence edits,
while splitting a series for this-and-future preserves factual history. Shared
types and expansion prevent web/native drift. February 29 yearly events occur
only in leap years, and same-date monthly rules skip months without that date,
so local calendar intent is never silently shifted.

### Recurring Android Reminders Use A 90-Day Horizon

Decision: Reconcile relative reminders for recurring event occurrences from
today through 90 days ahead. Notification IDs include series occurrence
identity and reminder identity. Startup rebuilds all pending app reminders;
targeted series edits cancel both previous and current horizon IDs.

Reason: This keeps multiple occurrence reminders correct without scheduling an
infinite series, and gives edits, moved exceptions, skipped occurrences, and
series splits deterministic cleanup behavior.

### Explicit Reminders Are Independent From Planning State

Decision: Replace offset-only domain intent with a shared reminder union. A
relative reminder uses a supported offset from an exact Scheduled task or fixed
event start. An explicit reminder stores a validated local date and time and can
belong to a Flexible, Planned, or Scheduled task without changing its placement.
Each item supports at most five unique reminders. Legacy relative offset fields
remain as compatibility projections.

Reason: Reminder intent and task placement answer different questions. Using
task schedule fields to represent a prompt would silently promote Flexible or
Planned work and corrupt Calendar semantics. One shared model also keeps task
and event validation, presentation, persistence, and notification identities in
sync.

### Reminder Storage Advances To Version 10 Without Rewriting Records

Decision: Keep migrations 8 and 9 unchanged, add nullable shared reminder JSON
columns in SQLite migration 10, and advance IndexedDB to version 10 without an
upgrade rewrite. Readers fall back to version 7 offset arrays when the new field
is absent. Relative notification identifiers retain their existing numeric
suffix; explicit reminders use a deterministic local date/time suffix.

Reason: Forward-only schema history lets already-upgraded installations open
safely. Nullable additive columns and fallback readers preserve Tasks, Events,
Recovery, Recap, Settings, execution history, and existing notification cleanup
without destructive conversion.

### Android Navigation Uses Labeled Icons And System Insets

Decision: Keep visible labels, add recognizable Expo vector icons, enforce
usable item height, and derive bottom padding from the Android safe-area inset.
Add Guide as a real seventh destination with shared factual content on web and
native.

Reason: Placeholder-style marks and controls next to the gesture area made
physical-phone navigation error-prone. System insets are more reliable than a
device-specific padding guess, and labels preserve accessibility and clarity.

## 2026-08-08

### Execution State Is Separate From Planning State

Decision: Implement `started` as the persisted In Progress state and store the
most recent `startedAt` timestamp. Start changes `not_started` to `started`;
Pause returns it to `not_started` without completion; completion always records
`completedAt`. Flexible, Planned, and Scheduled remain derived only from task
date/time fields.

Reason: A user needs to say "I am doing this now" without starting a timer or
claiming partial completion. Separate dimensions allow Scheduled + In Progress
and Flexible + Not Started without corrupting Calendar or Recap meaning.

### Multiple Reminder Arrays Supersede The Single Reminder Decision

Decision: Store up to five unique reminder offsets on each task or fixed event.
Use one deterministic native notification identity per item and offset. Preserve
legacy 10- and 30-minute choices while presenting 1 day, 1 hour, 15 minutes, and
At start as understandable options.

Reason: Multiple reminders are a real testing need. Offset identities let every
reschedule cancel stale notifications and rebuild valid future triggers without
coupling OS identifiers to core planning storage.

### Reminder Choices Persist When Delivery Is Inactive

Decision: Keep reminder arrays when a task becomes untimed, completed, removed,
delegated, or broken down. Cancel pending notifications when delivery is no
longer applicable and explain that untimed choices are saved but inactive.

Reason: Clearing configuration silently loses an explicit user choice. Stored
intent can be truthful without scheduling a stale or impossible notification.

### Recovery Entry Is Confirmation-Gated And Idempotent

Decision: Expose Plans changed? from every primary navigation surface. Route it
through an explanation with Start/Resume and Not now actions. Confirmation uses
`RecoveryRepository.startSession`, which returns the existing active session
before considering a new one.

Reason: Curious or accidental taps must change no data. Reusing the existing
repository preserves one Recovery mechanism and prevents duplicate active
sessions or automatic rescheduling.

### Task Date And Time Entry Uses Human Controls

Decision: Use native date/time pickers on Android and semantic date/time inputs
on web. Add quick planned-date and deadline choices resolved from local calendar
days. Keep `YYYY-MM-DD` and `HH:MM` as internal storage formats only.

Reason: Storage formats should not become a usability requirement. Platform
controls improve discoverability, validation, accessibility, and local-time
correctness without changing the domain model.

### Functional Completion Requires An End-To-End User Outcome

Decision: Apply one global definition of done to every current and future app
feature. A feature is complete only when a real user can perform the intended
action, receives understandable feedback, sees the correct result across
applicable surfaces, and sees persistent outcomes survive reload or app
restart. Every handoff must disclose UI that appears functional but is not
wired end to end.

Reason: Screens, labels, controls, routes, storage fields, services, placeholder
UI, and instantiating tests can all exist without delivering a usable outcome.
Treating those artifacts as implementation would hide broken user paths and
overstate product progress.

### Monetization Requires A Separate Phase And Boundary

Decision: Do not implement advertising, subscriptions, ad-free entitlements,
or Google Play Billing during the current Tasks phase. Keep future monetization
adapters separate from core planning logic, without adding speculative
monetization UI or services now.

Reason: Monetization needs its own product and implementation decisions. A
clean boundary allows later integration without making offline planning,
scheduling, or Recovery depend on advertising or billing systems.

### Planning State Is Derived

Decision: Derive Flexible, Planned, and Scheduled from nullable task date/time
fields instead of persisting a second planning-state column.

Reason: One source of truth prevents impossible combinations. Flexible clears
the planning date and both planning times, Planned stores a date with an optional
soft `preferredTime`, and Scheduled stores a date plus actual `scheduledTime`.
Only `scheduledTime` creates a hard placement. Explicit reminder date/times are
independent from placement; relative choices require an exact date and
scheduled time.

### One Breakdown Model

Decision: Use the same resolved-parent and unscheduled-child model for manual
and Recovery breakdown. Store a nullable direct `parentTaskId` on each smaller
task and keep the original as a visible `broken_down` container.

Reason: One model keeps Recovery, Tasks, persistence, and undo behavior
coherent without introducing a full project system. Breakdown undo is allowed
only while smaller tasks have no recorded progress.

### Removal Preserves History

Decision: Require confirmation before setting an active task to `removed`, keep
the row locally, and offer restoration. Do not convert completed tasks to
removed tasks.

Reason: The user can reduce the active list without losing task history or
corrupting completion-based Recap behavior.

### Task Editing Preserves Identity

Decision: Route every task edit through `TaskRepository.updateTask`, preserve
the task ID and relationship fields, and synchronize the deterministic reminder
identifiers after persistence.

Reason: Today, Calendar, reminders, and scheduling must update from one task
record rather than accumulate duplicates or stale notification intent.

### Scheduling Suggestions Never Mutate Automatically

Decision: Keep candidate generation pure, show at most three options, and
require a separate choose-and-confirm step. Acceptance re-runs the search and
updates the existing task only if the exact opening is still available.

Reason: Calendar whitespace is not proof of usable capacity. Explicit
confirmation and stale-slot revalidation preserve user control and prevent
overlaps caused by changed local data.

### Conservative Planning Defaults

Decision: Search seven days by default between 08:00 and 20:00, protect 15
minutes around fixed events, cap suggested task time at 180 minutes per day,
and expose only small preset alternatives in Settings. A user may extend one
search to 14 days.

Reason: These are transparent planning defaults, not medical claims. A bounded
search and task-time cap avoid treating every open minute as productive time.

### Unknown Timed Durations Block The Remaining Day

Decision: A fixed event or timed task without an end or estimate blocks from its
start through the planning-day end. Untimed dated tasks do not block exact time.

Reason: Guessing an end can create an overlap. The conservative result may omit
usable time, but it does not invent availability.

### Deadline Is Separate From Schedule

Decision: Store nullable `Task.deadlineDate` and nullable `Task.deadlineTime`.
Treat a date-only deadline as the end of that local calendar day and an exact
deadline time as a hard finish boundary, never as an automatic placement.

Reason: A finish boundary is required for useful bounded suggestions. Local
date/time strings avoid UTC shifts, and keeping deadline fields separate from
planning fields permits Flexible, Planned, and Scheduled tasks to share the same
deadline rules.

### Planned Preferred Time Is Soft

Decision: Store an optional exact local `Task.preferredTime` only on Planned
tasks. It never derives Scheduled state, reserves Calendar space, blocks a
scheduling candidate, or activates reminders. Converting to Scheduled moves an
explicit preferred time into `scheduledTime`; converting back moves the chosen
start into `preferredTime` while preserving task identity.

Reason: A user can record when work would suit them without representing that
preference as a fixed commitment. Soft scheduler ranking remains separate
follow-up work rather than an implied or hidden behavior.

### Recovery Scheduling Link Deferred

Decision: Keep Recovery's explicit reschedule form unchanged and provide the
scheduling entry point from Tasks.

Reason: Recovery integration is optional for this phase. Adding a partial path
inside an active decision flow risks confusing reversible Recovery state; the
shared service is ready for a later deliberate integration.

### Small Key-Value Settings Store

Decision: Persist app preferences through `SettingsRepository` using a native
SQLite `app_settings` table and a web IndexedDB `appSettings` store.

Reason: Preferences are local app state, not task or event properties. A shared
repository keeps defaults and validation out of UI components while preserving
the established platform-storage boundary.

### One Optional Reminder Per Scheduled Item (Superseded)

Status: Superseded by Multiple Reminder Arrays Supersede The Single Reminder
Decision on 2026-08-08.

Decision: Store one nullable offset of 0, 10, 30, or 60 minutes on a task or
fixed event. Do not add a default offset or multiple reminders.

Reason: A small choice set supports useful reminders without turning creation or
Settings into a high-load control panel. Requiring a date, time, and future
trigger prevents ambiguous reminder intent.

### Disabling Reminders Cancels Scheduled Notifications

Decision: Keep item-level reminder intent in local storage but cancel all OS
notifications when the master setting is turned off. Reconcile future eligible
items when it is turned back on.

Reason: The switch has an immediate, testable consequence while preserving the
user's explicit item choices for later. Reconciliation prevents stale or
duplicate scheduled notifications.

### Domain Intent Is Separate From Expo Notifications

Decision: Put reminder rules in repositories and `ReminderService`, and isolate
Expo APIs behind `NotificationAdapter`. Use deterministic IDs derived from item
type, ID, and reminder offset.

Reason: Persistence and Recovery behavior can be tested without receiving a real
OS notification. Cancel-before-schedule behavior prevents duplicates without a
second identifier table.

### Permission Is Requested Only On Explicit Enable

Decision: Do not request notification permission at startup. If permission is
denied, leave reminders off, keep the planning app usable, and offer a route to
device settings without prompting again.

Reason: Notifications are optional and must never block core offline planning or
become a repeated source of pressure.

### Web Notifications Are Unsupported In This Phase

Decision: Persist settings with the established web architecture but use an
unsupported notification adapter and show an accurate Android-app-only state.

Reason: Fake or unreliable browser notification behavior would violate user
trust. Accessibility, privacy, and app information remain available on web.

### System Accessibility Preferences First

Decision: Preserve native font scaling, browser zoom, focus-visible behavior,
and system reduced-motion support instead of adding duplicate app-specific text,
contrast, or motion controls.

Reason: Those system capabilities provide real value now. A custom theme or
dynamic-type system would add broad complexity without evidence that it is the
highest-value accessibility fix.

### Quiet Hours And Exact Alarms Deferred

Decision: Do not half-implement quiet hours and do not add Android exact-alarm
permission in this phase.

Reason: Quiet hours require clear rules for fixed events and day boundaries.
Exact-alarm access is policy-sensitive and belongs in release-build and Google
Play review rather than being added silently.

## 2026-08-07

### Daily Recap Is Derived

Decision: Build Daily Recap from task completion timestamps, fixed calendar
events, and Recovery sessions instead of storing a recap record or cache.

Reason: The source records already contain the facts. Derivation avoids stale
summaries after completion undo or a changed active Recovery decision and
requires no migration.

### Completion Date Is Not Scheduled Date

Decision: Count a task under Accomplished only when its non-null `completedAt`
instant falls on the selected device-local date.

Reason: A task completed today is an accomplishment today even when it was
scheduled for another date. Legacy completed records with unknown timestamps
remain readable without invented history.

### Recovery Decisions Count As Plan Adjustments

Decision: Show final Keep, Reschedule, Break Down, Delegate, and Remove decisions
as factual plan adjustments. Keep the underlying active work and Decide Later
items under calm still-open context.

Reason: Reducing or clarifying the plan is legitimate recorded work, but it is
not task completion and must stay separate from Accomplished.

### No Recap Score Or Partial-Progress Percentage

Decision: Use deterministic supportive messages and factual counts only. Defer
partial-progress measurement until the task workflow can record meaningful
progress directly.

Reason: A percentage added solely for Recap would become an arbitrary grade and
would introduce project tracking beyond the approved scope.

### One Active Recovery Session

Decision: Persist one active Recovery Mode session at a time and resume it even
if the user opens Recovery from another date.

Reason: One unfinished review keeps state understandable and prevents duplicate
decisions for the same work. A future flow can add an explicit abandon/archive
action if product requirements call for it.

### Decisions Mutate Tasks And Preserve Recovery History

Decision: Keep and Reschedule update the original task; Break Down, Delegate,
and Remove resolve the original with explicit statuses. Recovery items retain a
snapshot and decision metadata.

Reason: Rescheduling must preserve task identity, while delegated, removed, and
broken-down work should leave active planning without erasing what happened.

### Decide Later Remains Pending

Decision: Store `skip` as a review marker but leave the item pending.

Reason: The user can reduce immediate cognitive load without accidentally
treating an undecided task as resolved.

### No Automatic Tomorrow Placement

Decision: Keep clears the schedule, breakdown children start unscheduled, and
only explicit Reschedule sets a new date.

Reason: Recovery must reduce future workload rather than transfer the entire
unfinished list to tomorrow.

### Recovery Storage Parity

Decision: Add SQLite migration 3 and IndexedDB version 3 with matching recovery
session/item concepts and atomic task-decision mutations.

Reason: Recovery progress must survive app restarts and browser refreshes while
the shared repository keeps behavior consistent across platforms.

## 2026-08-06

### Calendar As The Structural Center

Decision: Add Calendar as a first-class destination with Month, Week, and Day
views, rather than embedding a date grid inside Tasks.

Reason: The product needs to explain what is fixed, planned, and flexible before
future scheduling or recovery logic can be trustworthy.

### Fixed Events Remain Separate From Tasks

Decision: Model calendar commitments in `CalendarEvent` with `kind: fixed` and
keep scheduling fields on `Task`.

Reason: Future scheduling may move flexible tasks but must never automatically
move fixed commitments. Converting either entity into the other would erase
that safety boundary.

### Local Calendar Values Stay As Strings

Decision: Store event and task dates as `YYYY-MM-DD` and wall-clock times as
`HH:MM`, without UTC conversion.

Reason: Date-only values must not shift days because of timezone conversion.
Timestamps remain ISO instants only for record history.

### Factual Schedule Summaries

Decision: Week and day summaries report stored counts and known minutes only.
Event minutes come from an explicit duration or end time, and task minutes come
from an estimate.

Reason: The foundation has no approved capacity or overload rule. Empty time is
not labeled as available capacity, and unknown durations are not guessed.

### Shared Calendar UI With Responsive Reflow

Decision: Use one React Native calendar screen for native and web, with a wide
month grid plus day-detail panel on desktop and stacked week/day layouts at
narrow widths. Keep platform-specific semantic forms for event and task entry.

Reason: Calendar behavior should not drift across platforms, while browser forms
benefit from native date/time controls and HTML keyboard semantics.

### One Shared Expo Codebase

Decision: Keep Android, future iOS, and web in the existing Expo Router project.

Reason: Task behavior and product language should remain consistent, and a
second application would create avoidable duplication and drift.

### Platform-Specific Web Files

Decision: Use Expo and Expo Router platform extensions for web navigation,
screens, task lists, forms, repository composition, and page styling.

Reason: Desktop navigation and browser form semantics differ from mobile while
the domain behavior remains shared. Platform files localize those differences
without scattered runtime platform checks.

### IndexedDB For Web Persistence

Decision: Store web tasks and events in versioned IndexedDB object stores behind
shared storage contracts.

Reason: Expo SQLite web support in installed SDK 57 is documented as alpha and
requires WebAssembly setup plus cross-origin-isolation headers. IndexedDB is a
built-in durable browser database, works offline, and requires no server or task
data transmission.

Tradeoffs: IndexedDB and native SQLite require separate migration paths.
Browser storage can be cleared or evicted, and browser/native data do not share
automatically.

### Separate Web And Native Data

Decision: Keep browser and mobile task data separate for the current prototype.

Reason: Cross-device data requires cloud sync, account, privacy, security, and
conflict-resolution decisions that are outside the approved scope.

## 2026-08-04

### Working Name: ADHD Calendar

Reason: The product owner supplied this working title for the initial mobile
application foundation.

### Mobile Framework: Expo

Reason: Expo matches the requested stack, supports React Native and TypeScript,
and keeps the first Android build path straightforward while preserving a future
iOS path.

### Android First

Reason: Android is the first requested testing platform. The structure remains
compatible with future iOS support.

### Local First

Reason: Core task-management behavior must work offline, and no cloud services
are approved for this assignment.

### SQLite

Reason: Expo SQLite gives durable local persistence with a migration path and
keeps task data on device for this first build.

### Rule-Based Scheduling Direction

Reason: Scheduling and recovery behavior should be predictable, inspectable,
and testable. AI assistance is deferred until explicitly approved.

### Cloud Services And AI Deferred

Reason: External APIs, cloud synchronization, analytics, and AI services are out
of scope for the first build and require product-owner approval.

## Assumptions

- Expo SDK 57 is acceptable because it is the current npm-published Expo SDK at
  implementation time.
- Node.js should be upgraded to 20.19.4 or newer before Android runtime testing
  because React Native 0.86 declares that engine requirement.
- Plain text date and time entry is acceptable for the current build; native date
  and time pickers can be added later.
- Repository-level SQLite tests are sufficient for the first build because the
  most important risk is local persistence correctness.

## Unresolved Questions

- What final product name should replace the working title?
- How should the future three-priority system choose or suggest daily
  priorities?
- What should count as an essential task during Recovery Mode?
- What accessibility settings should be configurable beyond system defaults?
- Should a future local import/export feature bridge browser and mobile data
  before cloud synchronization is considered?
- Should week view start on Sunday, Monday, or follow a configurable locale
  preference? The foundation currently starts on Sunday.
- What retention or backup guidance should the web UI provide before the
  prototype is used for important long-term planning data?
- What user action and data shape should represent partial progress without
  requiring percentage-based project tracking?
- Should the Android release request exact-alarm access, accept inexact delivery,
  or use a different scheduling strategy after release-build measurement?
- What finalized privacy-policy destination should About link to during Google
  Play preparation?
- Which existing screens need layout changes after hands-on testing with the
  largest Android font and display-size settings?

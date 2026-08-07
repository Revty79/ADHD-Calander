# Decision Log

## 2026-08-07

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
- Should task editing be included before or after the first Recovery Mode slice?
- What accessibility settings should be configurable beyond system defaults?
- Should a future local import/export feature bridge browser and mobile data
  before cloud synchronization is considered?
- Should week view start on Sunday, Monday, or follow a configurable locale
  preference? The foundation currently starts on Sunday.
- When should event and task editing, deletion, and reversible undo flows be
  introduced?
- What retention or backup guidance should the web UI provide before the
  prototype is used for important long-term planning data?

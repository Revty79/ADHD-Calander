# Decision Log

## 2026-08-06

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

Decision: Store web tasks in a versioned IndexedDB object store behind the
shared `TaskStorage` contract.

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
- Plain text date and time entry is acceptable for the first build; native date
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
- What retention or backup guidance should the web UI provide before the
  prototype is used for important long-term planning data?

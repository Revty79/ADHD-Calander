# Web Architecture

## Purpose

The web build is an early desktop and small-browser prototype in the same Expo
Router application as Android and future iOS builds. It supports the current
task flow without introducing cloud services or a second application folder.

## Shared And Platform-Specific Files

Shared code continues to own:

- Task and fixed-event types.
- Task and event input validation and normalization.
- Recovery session rules and task mutations.
- Local date and time handling.
- Month/week/day date math and factual schedule aggregation.
- Task creation, completion, and completion undo behavior.
- Task ordering and non-deleted task filtering.
- Repository errors and user-facing persistence wording.
- Native database migrations and storage contracts.
- Task-editor state transitions and submitted domain input.
- Recap date validation and route-date fallback behavior.
- Planning-setting labels and explanatory copy.

Platform-specific files own:

- `app/_layout.web.tsx`: web root styling and navigation stack presentation.
- `app/(tabs)/_layout.web.tsx`: responsive sidebar and compact navigation.
- `app/(tabs)/index.web.tsx`: desktop-oriented Today layout and factual counts.
- `app/(tabs)/tasks.web.tsx`: wider all-tasks layout.
- `app/(tabs)/recovery.web.tsx`: one-task recovery review and semantic forms.
- `app/(tabs)/recap.web.tsx`: semantic date controls and a responsive derived
  daily recap.
- `app/(tabs)/settings.web.tsx`: semantic accessibility, privacy, app-info, and
  accurate notification-support sections.
- `app/recovery/start.web.tsx`: confirmation-gated Recovery start or resume.
- `app/tasks/new.web.tsx`: semantic browser form controls.
- `app/tasks/[id]/schedule.web.tsx`: semantic suggestion selection and explicit
  scheduling confirmation.
- `app/events/new.web.tsx`: semantic browser event form controls.
- `src/components/Screen.web.tsx`: web page sizing for shared placeholder pages.
- `src/features/tasks/components/TaskList.web.tsx`: semantic web task lists.
- `src/database/createRepositories.web.ts`: web repository composition.
- `src/database/indexedDbTaskStorage.web.ts`: browser persistence adapter.
- `src/styles/web.css`: responsive and focus-visible web styling.

Non-web files with the same base names remain the native implementation. Expo
and Expo Router select the correct file by platform.

## Navigation Design

At widths above 760 pixels, the main routes appear in a left sidebar. The active
route has a visible `Current` label, a stronger border, and `aria-current` state.
At 760 pixels and below, navigation becomes a compact six-item header. Every
destination remains a normal keyboard-focusable link.

A persistent "Plans changed?" action appears alongside the primary navigation
at every responsive size. It always opens the Recovery explanation first;
cancelling does not create or mutate a session.

Task and event forms are focused pages outside the tab shell. Task creation can
return to Today, Tasks, or its selected Calendar date.

## Persistence Design

Native builds continue to initialize Expo SQLite, apply versioned SQL
migrations, and use SQL storage adapters. The web build opens IndexedDB database
`adhd-calendar-web` at version 9 with `tasks`, `calendarEvents`,
`recoverySessions`, `recoveryItems`, and `appSettings` stores.

`TaskRepository`, `CalendarEventRepository`, and `RecoveryRepository` depend on
platform-neutral storage contracts. Both platforms return the same domain
shapes, while validation and recovery rules remain in shared repositories.
IndexedDB recovery decisions update task records and recovery items in one
transaction.

IndexedDB version 7 stores task and event reminder-offset arrays, Recovery
reminder snapshots, and task execution timestamps. Its upgrade path converts
version 6 single-reminder records and preserves in-progress tasks. Version 8 is
a forward-only compatibility marker retained after the planned-time-preference
product rollback. It performs no current product migration, allows databases
already opened by the former version 8 build to reopen, and leaves existing
records unchanged. Version 9 advances storage forward without rewriting records;
missing `preferredTime`, `deadlineTime`, and Recovery `originalPreferredTime`
values deserialize as `null` until the record is next written normally. Legacy
version 8 planned-period fields remain readable but ignored as a compatibility
fallback.

`SettingsRepository` uses the `appSettings` store through a shared storage
contract. `ReminderService` is also composed on web, but receives
`UnsupportedNotificationAdapter`: it schedules nothing and reports
`unsupported`. The Settings screen explains that reminders are available in the
Android app and never asks for browser notification permission.

`DailyRecapRepository` composes those shared repositories and persists nothing.
IndexedDB recovery sessions are filtered by source date in the adapter without
an object-store version change. Legacy task records that omit `completedAt` are
read as having an unknown completion time, and records that omit `deadlineDate`
or its optional `deadlineTime` are read with no deadline date or exact time.

IndexedDB was selected because Expo SQLite web support in the installed SDK 57
is documented as alpha and requires WebAssembly configuration plus
cross-origin-isolation response headers. IndexedDB is built into supported
browsers, persists structured local data across restarts, and does not require a
server. The tradeoff is a separate web migration path and no automatic data
sharing with native SQLite.

## Responsive Layout Rules

- Above 960 pixels: Today uses a main task column plus a sticky summary panel.
- At 1000 pixels and above: Month uses a wide grid plus selected-day panel and
  Week uses seven horizontal columns.
- Below 1000 pixels: selected-day detail stacks below Month and Week becomes a
  readable seven-day list.
- From 761 to 960 pixels: the summary panel stacks with the task content.
- At 760 pixels and below: the sidebar becomes compact top navigation.
- At 560 pixels and below: page headers, task cards, form fields, and actions
  stack vertically.
- Recovery uses a prominent review card plus a sticky progress summary on wide
  screens and a single stacked column on narrower screens.
- Recap uses a wide accomplishment area with smaller factual calendar and
  Recovery context panels, then stacks into one column below 960 pixels.
- Scheduling assistance uses up to three side-by-side suggestion cards on wide
  screens and one vertical column below 960 pixels. Every option is a semantic
  button with visible focus, pressed state, and descriptive accessible text.

Content uses maximum widths, flexible grid columns, wrapping metadata, and
breakable task text to avoid ordinary horizontal scrolling. Browser zoom and
larger text remain supported because sizing is primarily fluid and relative.
Visible focus outlines remain enabled, and a reduced-motion media query removes
nonessential animation and transition duration when the operating system asks
for reduced motion.

## Known Limitations

- Browser data is specific to the current browser profile and origin.
- Private browsing, user-cleared site data, storage pressure, or browser policy
  can remove IndexedDB data.
- Web and native tasks are separate and cannot currently be imported or synced.
- Web notification scheduling is deliberately unsupported; Settings reports the
  Android-app-only availability accurately, and forms do not imply otherwise.
- Completed legacy tasks without a known completion timestamp cannot appear on
  a historical Recap date.
- Completed recovery sessions are retained but do not yet have a history browser.
- Event editing/deletion, task filtering and sorting controls, custom reminder
  offsets, and recurring items are not implemented.

## Future Cross-Platform Work

Future task behavior should be added to a shared repository or domain service
first. Platform adapters should only translate that behavior to SQLite or
IndexedDB. Any new stored field requires an explicit native SQL migration and a
corresponding IndexedDB version upgrade, with both paths tested against the
shared contract.

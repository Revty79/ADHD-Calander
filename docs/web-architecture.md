# Web Architecture

## Purpose

The web build is an early desktop and small-browser prototype in the same Expo
Router application as Android and future iOS builds. It supports the current
task flow without introducing cloud services or a second application folder.

## Shared And Platform-Specific Files

Shared code continues to own:

- Task types and status values.
- Task input validation and normalization.
- Local date and time handling.
- Task creation, completion, and completion undo behavior.
- Task ordering and non-deleted task filtering.
- Repository errors and user-facing persistence wording.
- Native database migrations and the task storage contract.

Platform-specific files own:

- `app/_layout.web.tsx`: web root styling and navigation stack presentation.
- `app/(tabs)/_layout.web.tsx`: responsive sidebar and compact navigation.
- `app/(tabs)/index.web.tsx`: desktop-oriented Today layout and factual counts.
- `app/(tabs)/tasks.web.tsx`: wider all-tasks layout.
- `app/tasks/new.web.tsx`: semantic browser form controls.
- `src/components/Screen.web.tsx`: web page sizing for shared placeholder pages.
- `src/features/tasks/components/TaskList.web.tsx`: semantic web task lists.
- `src/database/createTaskRepository.web.ts`: web repository composition.
- `src/database/indexedDbTaskStorage.web.ts`: browser persistence adapter.
- `src/styles/web.css`: responsive and focus-visible web styling.

Non-web files with the same base names remain the native implementation. Expo
and Expo Router select the correct file by platform.

## Navigation Design

At widths above 760 pixels, the main routes appear in a left sidebar. The active
route has a visible `Current` label, a stronger border, and `aria-current` state.
At 760 pixels and below, navigation becomes a compact five-item header. Every
destination remains a normal keyboard-focusable link.

The task form is presented as a focused page outside the tab shell. It includes
a clear link back to Today or Tasks based on where creation started.

## Persistence Design

Native builds continue to initialize Expo SQLite, apply versioned SQL
migrations, and use `SqlTaskStorage`. The web build opens an IndexedDB database
named `adhd-calendar-web` and uses a versioned `tasks` object store with indexes
for scheduled date and update timestamp.

`TaskRepository` depends on the platform-neutral `TaskStorage` contract. Both
adapters store and return the same `Task` shape, while validation, mutations,
ordering, and errors remain in the shared repository.

IndexedDB was selected because Expo SQLite web support in the installed SDK 57
is documented as alpha and requires WebAssembly configuration plus
cross-origin-isolation response headers. IndexedDB is built into supported
browsers, persists structured local data across restarts, and does not require a
server. The tradeoff is a separate web migration path and no automatic data
sharing with native SQLite.

## Responsive Layout Rules

- Above 960 pixels: Today uses a main task column plus a sticky summary panel.
- From 761 to 960 pixels: the summary panel stacks with the task content.
- At 760 pixels and below: the sidebar becomes compact top navigation.
- At 560 pixels and below: page headers, task cards, form fields, and actions
  stack vertically.

Content uses maximum widths, flexible grid columns, wrapping metadata, and
breakable task text to avoid ordinary horizontal scrolling. Browser zoom and
larger text remain supported because sizing is primarily fluid and relative.

## Known Limitations

- Browser data is specific to the current browser profile and origin.
- Private browsing, user-cleared site data, storage pressure, or browser policy
  can remove IndexedDB data.
- Web and native tasks are separate and cannot currently be imported or synced.
- Only the existing task flow is functional; Recovery, Recap, and Settings stay
  as calm placeholders.
- Task editing, deletion, filtering, sorting controls, calendar views,
  notifications, and recurring tasks are not implemented.

## Future Cross-Platform Work

Future task behavior should be added to `TaskRepository` or another shared
domain service first. Platform adapters should only translate that behavior to
SQLite or IndexedDB. Any new stored field requires an explicit native SQL
migration and a corresponding IndexedDB version upgrade, with both paths tested
against the shared task contract.

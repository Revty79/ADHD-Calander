# ADHD Calendar

ADHD Calendar is a recovery-first calendar and task-planning app for adults
with ADHD and executive-function challenges. It should become more helpful,
not more judgmental, when a plan stops matching the day.

## Current Development Status

The current prototype supports Android, responsive web browsers, and a shared
code structure for future iOS work. It includes:

- Navigation between Today, Calendar, Tasks, Recovery, Recap, and Settings.
- Month, Week, and Day calendar views with selectable dates and factual schedule
  summaries.
- Creating fixed events with a local date, start time, optional end time or
  duration, and optional notes.
- Quick task capture plus optional notes, importance, Flexible/Planned/Scheduled
  state, duration estimate, deadline, and reminder.
- Opening and editing a persisted task without changing its identity or creating
  a duplicate.
- Breaking tasks into related smaller tasks outside or inside Recovery Mode,
  then editing and completing those steps individually.
- Confirmed removal from active tasks, restoration, and reversible completion or
  breakdown actions where recorded progress permits it.
- Distinct calendar treatment for fixed commitments, planned tasks, and flexible
  date-associated tasks.
- Viewing today's tasks and all current non-deleted tasks.
- Completing a task and undoing completion.
- Starting a one-task-at-a-time Recovery Mode review for any local date.
- Keeping tasks unscheduled, explicitly rescheduling, breaking work into smaller
  unscheduled tasks, delegating locally, removing from active planning, or deciding
  later.
- Persisting active Recovery Mode progress and its decision history locally.
- Reviewing a selected local date in Recap, with tasks grouped by their actual
  completion timestamp rather than their scheduled date.
- Showing fixed calendar commitments factually, summarizing Recovery decisions,
  and keeping still-open work calm and secondary.
- Native persistence in Expo SQLite.
- Browser persistence in IndexedDB.
- Desktop sidebar navigation and compact navigation at smaller browser widths.
- Functional Settings sections for reminders, accessibility, local data, and
  app information.
- One optional local reminder for a native scheduled task or fixed event, with
  cancellation on completion and synchronization through Recovery decisions.
- Safe notification permission handling that leaves all planning features usable
  when reminders are off or permission is denied.
- Deterministic scheduling assistance for flexible tasks, with up to three
  explainable options inside local planning hours.
- Explicit two-step scheduling confirmation that preserves the task record,
  revalidates the opening, and keeps reminder intent synchronized.
- Local planning preferences for day start/end, fixed-event transition buffer,
  and maximum suggested task time per day.

Recurring events, event editing, automatic schedule optimization or
rescheduling, advanced notification policy, quiet hours, cloud sync, AI
features, subscriptions, and external calendar integrations remain deferred.

## Supported Platforms

- Android: current native development target.
- Web: functional early desktop and narrow-browser prototype.
- iOS: not manually verified in this repository, but native code and shared
  architecture remain compatible with future iOS work.

## Technical Stack

- Expo SDK 57.0.10
- Expo Router 57.0.10
- React Native 0.86.2
- React 19.2.3
- TypeScript 6
- Expo SQLite for native storage
- Expo Notifications for native local reminders
- IndexedDB for web storage
- Node test runner with `tsx`

## Prerequisites

- Node.js 20.19.4 or newer.
- npm 10 or newer.
- A current desktop browser with IndexedDB enabled for web development.
- Android Studio with an emulator, or a physical Android device, for Android
  runtime testing.
- Expo Go or a development build workflow for device testing.

## Installation

For a clean install from the lockfile:

```bash
npm ci
```

Use `npm install` when intentionally updating dependencies.

## Web Development

Start the web application:

```bash
npm run web
```

Expo opens or prints the local browser URL. The web app uses a left sidebar at
desktop widths, gives the calendar a wide month workspace and selected-day
panel, reflows the week into a list on narrow screens, and switches to compact
top navigation at 760 pixels.

Create a production-style static web export in `dist/`:

```bash
npm run web:export
```

Deployment is not configured in this prototype.

## Browser Persistence

Web tasks, events, and Recovery Mode sessions are stored in the browser's
IndexedDB database and are not sent to a server. Data survives normal page
refreshes, browser restarts, and development server restarts for the same browser
profile and origin.

Browser and mobile data are currently separate. Clearing site data, using
private browsing, browser storage pressure, or browser policy restrictions can
remove or disable browser data. There is no backup, import/export, cloud sync,
or cross-device transfer yet.

## Android Development

1. Install dependencies with `npm ci`.
2. Confirm Node is 20.19.4 or newer with `node --version`.
3. Start an Android emulator or connect a physical Android device with USB
   debugging enabled.
4. Run `npm run android`.
5. If Expo asks, choose the available Android target.

Native task, calendar-event, Recovery Mode, and Settings data use Expo SQLite
and versioned SQL migrations. Local reminders are optional and request
notification permission only after the user turns them on. Web does not schedule
notifications and shows an accurate Android-app-only state.

## Development Commands

```bash
npm run dev
npm run android
npm run web
npm run web:export
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run validate
```

`npm run validate` checks formatting, linting, TypeScript, and all repository
and browser-storage tests. GitHub Actions runs the same validation plus a web
export on pull requests and pushes to `main`.

## Project Structure

```text
app/
  (tabs)/                    Shared and platform-specific route screens
  events/new.tsx             Native event creation
  events/new.web.tsx         Browser event creation
  tasks/new.tsx              Native task creation
  tasks/new.web.tsx          Browser task creation
  tasks/[id]/index.tsx       Native task detail and actions
  tasks/[id]/edit.tsx        Native task editing
  tasks/[id]/breakdown.tsx   Native manual breakdown
  tasks/[id]/schedule.tsx    Native scheduling confirmation workflow
  tasks/[id]/schedule.web.tsx Browser scheduling confirmation workflow
src/
  components/                Shared and web-specific UI primitives
  database/                  Storage contract, adapters, migrations, repository
  features/calendar/         Local-date math, aggregation, and calendar hook
  features/recovery/         Recovery session hook and presentation helpers
  features/recap/            Daily recap hook and presentation helpers
  features/reminders/        Native reminder selection controls
  features/settings/         Repository-backed Settings hooks
  features/scheduling/       Deterministic candidate engine and acceptance service
  features/tasks/            Shared hooks and platform task lists
  features/today/            Today plan aggregation hook
  styles/web.css             Responsive web styles
  types/                     Shared TypeScript domain types
  notifications/             Reminder rules, service, and platform adapters
  utils/                     Shared date and ID helpers
docs/                        Product and architecture documentation
tests/                       SQLite repository and IndexedDB adapter tests
```

See `docs/calendar-architecture.md`, `docs/recovery-architecture.md`,
`docs/recap-architecture.md`, `docs/settings-architecture.md`,
`docs/notifications-architecture.md`, and `docs/web-architecture.md` for
calendar, recovery, recap, settings, reminders, persistence, responsive layout,
and shared-code decisions. `docs/scheduling-architecture.md` documents the
candidate-window, ranking, load, confirmation, and reminder rules.

## Known Limitations

- Legacy completed tasks without a recorded completion timestamp remain
  readable but cannot be assigned to a historical Recap date.
- Partial-progress recording is not implemented; Recap uses only completed
  tasks and explicit Recovery decisions.
- Recovery decisions can be changed while a session is active, but completed
  recovery sessions are currently read-only.
- Delegation stores only a local note; it does not contact another person.
- Mobile date and time entry still use plain text fields.
- Events can be created and viewed but not edited or deleted yet.
- Scheduling assistance uses one shared daily planning window rather than a
  weekday-by-weekday availability editor.
- A fixed event or timed task with no known duration conservatively blocks the
  rest of that planning day; event editing remains deferred.
- Recovery Mode does not yet link directly into scheduling assistance after an
  explicit Reschedule decision; Tasks is the supported entry point.
- No event editing/deletion, task filtering or sorting controls, drag-and-drop,
  recurring items, quiet hours, default reminders, or multiple reminders exist.
- Task breakdown is intentionally direct parent-to-child structure, not a
  multi-level project-management system.
- Browser notifications are intentionally unsupported in this phase.
- Android notification delivery, denial/grant flows, battery behavior, and
  release-build configuration still need emulator or physical-device testing;
  Expo Go behavior is not production proof.
- Web and mobile stores do not sync and cannot import from one another.
- Browser storage has no backup flow and may be cleared by the user or browser.
- No component testing framework is configured; automated coverage focuses on
  persistence, migrations, validation, dates, and shared repository behavior.
- Cloud services, authentication, analytics, AI, payments, and deployment are
  not configured.

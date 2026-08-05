# ADHD Calendar

ADHD Calendar is a recovery-first mobile calendar and task-planning app for
adults with ADHD and executive-function challenges. The product should become
more helpful, not more judgmental, when a user falls behind.

## Current Development Status

This repository contains the first application foundation and minimal task flow.
The current build supports:

- Tab navigation between Today, Tasks, Recovery, Recap, and Settings.
- Creating a basic locally stored task.
- Viewing tasks scheduled for today.
- Marking a task complete.
- Undoing task completion.
- Persisting task data in local SQLite storage.

Recovery Mode, recap generation, scheduling automation, notifications, cloud
sync, AI features, subscriptions, and calendar integrations are intentionally
deferred.

## Technical Stack

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript
- Expo Router
- Expo SQLite
- Local-first storage
- Node test runner with `tsx`

## Prerequisites

- Node.js 20.19.4 or newer. React Native 0.86 and Metro declare this minimum.
- npm 11 or newer.
- Android Studio with an Android emulator, or a physical Android device.
- Expo Go or a development build workflow for device testing.

The workspace used for this initial implementation had Node.js 20.17.0, which is
below the React Native engine requirement. Unit tests and type checks can still
run, but starting Metro may require upgrading Node first.

## Installation

```bash
npm install
```

## Development Commands

```bash
npm run dev
npm run android
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run validate
```

## Android Run Instructions

1. Install dependencies with `npm install`.
2. Confirm Node is 20.19.4 or newer with `node --version`.
3. Start an Android emulator or connect a physical Android device with USB
   debugging enabled.
4. Run `npm run android`.
5. If Expo asks, choose the available Android target.

## Project Structure

```text
app/
  (tabs)/              Expo Router tab screens
  tasks/new.tsx        Task creation modal
src/
  components/          Shared UI primitives
  database/            SQLite adapter, migrations, repository layer
  features/tasks/      Task list components and hooks
  types/               Shared TypeScript domain types
  utils/               Date and ID helpers
docs/                  Product and technical documentation
tests/                 Repository and migration tests
```

## Known Limitations

- Recovery Mode and Recap are placeholders.
- Only two task statuses are implemented in the UI: not started and completed.
- Task date and time entry use plain text fields.
- No task editing, soft deletion, advanced scheduling, reminders, or calendar
  integration exists yet.
- No component test suite is configured yet; current automated coverage focuses
  on SQLite migration and repository behavior.
- `npm install` reports moderate vulnerabilities in transitive Expo/React Native
  dependencies. They were not force-fixed because doing so may introduce
  breaking dependency changes.

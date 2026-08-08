# Settings Architecture

## Purpose

Settings provides a small user-control surface rather than a general control
panel. The current sections are Reminders, Planning, Accessibility, Data and
privacy, and About. The default app remains usable without configuring anything.

## Shared Preference Boundary

`SettingsRepository` owns preference defaults, validation, and persistence.
The UI uses repository-backed hooks and never reads SQLite or IndexedDB
directly. Supported settings are:

- `remindersEnabled`: defaults to `false` and controls all local task and event
  scheduling.
- `planningDayStart`: defaults to `08:00`.
- `planningDayEnd`: defaults to `20:00`.
- `transitionBufferMinutes`: defaults to `15` around fixed commitments.
- `maxSuggestedTaskMinutesPerDay`: defaults to `180` known task minutes.

Native stores these values in SQLite `app_settings`; web stores the same logical
keys in the IndexedDB `appSettings` object store. Both adapters implement the
shared `SettingsStorage` contract. Browser and native settings remain separate,
just like their task and event data. Start must remain earlier than end, and
numeric values must come from the small supported option sets.

## Settings Presentation

The native Settings screen exposes the functional reminder master switch,
permission status, a route to device settings after denial, accessibility
guidance, four functional planning controls, local-data facts, and app version.
Enabling reminders is the only
action that can request notification permission.

The web Settings screen exposes equivalent semantic planning selects and
accurately reports that task and event notifications are available in the
Android app without requesting browser notification permission. The setting
repository and IndexedDB adapter maintain cross-platform persistence parity.

No privacy-policy URL is shown because no approved policy target exists yet.
The About section provides a structural place to add the finalized policy during
Google Play release preparation.

## Accessibility Foundation

- Native text retains React Native font scaling rather than setting
  `allowFontScaling={false}`.
- New switches, radio choices, and actions have explicit roles, labels, state,
  and at least 48-pixel target height.
- Web Settings uses headings, landmarks, status text, and fluid grid layouts.
- Existing web focus-visible outlines remain enabled for links, buttons, and
  form controls.
- Web CSS disables nonessential animation and transition duration when
  `prefers-reduced-motion: reduce` is active.
- Fixed events, task types, completion, and Recovery decisions continue to use
  text labels rather than color alone.

The app does not add custom text-size, contrast, or motion toggles. Current
system font scaling, browser zoom, and reduced-motion preferences provide the
real behavior without creating a duplicate theme system. Larger native dynamic
type still needs hands-on device review across every existing screen.

## Deliberately Deferred

- Default reminder offsets
- Quiet hours
- Custom notification sounds or urgency levels
- App-specific font-size, contrast, or density themes
- Weekly availability editors, separate weekday hours, preferred work periods,
  and energy profiles
- Privacy-policy destination and Google Play disclosure content
- Import/export, accounts, cloud synchronization, and cross-device preferences

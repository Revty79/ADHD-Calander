# Product Principles

## Recovery-First Planning

The application should become more useful when the user falls behind. Recovery
behavior should reduce overload, preserve progress, and avoid turning a missed
plan into a larger next-day burden.

## Non-Shaming Language

- Use factual, calm, and direct language.
- Do not describe missed work as failure.
- Do not use streak loss, warnings, or alarming visual treatment as motivation.
- Encouragement must be based on recorded user actions.

## User Control

- Do not silently delete, complete, reschedule, or move important user data.
- Make important actions reversible where practical.
- Fixed appointments must never be moved automatically.
- Recovery review should let users inspect tasks individually before committing
  changes.

## Accessibility

- Support system font scaling.
- Use readable typography and accessible touch targets.
- Do not communicate task state only through color.
- Add screen-reader labels to controls.
- Avoid unnecessary animation.
- Respect system reduced-motion preferences and keep state understandable
  without motion.
- Keep keyboard focus visible and use semantic headings and form errors on web.

## Conservative Scheduling Assistance

- Treat calendar whitespace as unknown capacity, not automatically productive
  time.
- Offer a small number of deterministic, explainable suggestions rather than
  filling a day.
- Respect local planning hours, fixed commitments, timed tasks, transition
  buffers, deadlines, and a daily suggested-task limit.
- Revalidate a selected opening and require explicit confirmation before
  changing the task.
- Scheduling assistance may update a flexible task but must never move a fixed
  event or automatically reschedule unfinished work.

## Reminders Without Pressure

- Reminders are optional and require an explicit scheduled date and time.
- Ask for notification permission only after the user chooses to enable reminders.
- Keep task and calendar features fully usable after permission denial.
- Use factual timing copy without blame, fake urgency, repeated nagging, or
  productivity judgment.

## Functional Completeness

- Judge every current and future feature by real user outcomes, not by the
  presence of screens, labels, controls, routes, storage fields, service
  boundaries, placeholder UI, or tests that only instantiate it.
- A complete feature lets a real user perform its intended action, gives
  understandable feedback, updates every applicable app surface, and persists
  the result across reload or app restart when the outcome is persistent.
- Apply this standard to Today, Tasks, Calendar, Recovery, Recap, Scheduling,
  Reminders, Settings, Accessibility, onboarding, monetization, and every future
  feature.
- Never present decorative or unwired UI as functioning behavior. Every project
  handoff must explicitly disclose controls or surfaces that appear functional
  but are not wired end to end.

## Privacy And Scope

- Core task-management features must work offline.
- Avoid collecting unnecessary information.
- Do not add cloud services, analytics, external APIs, or AI services without
  approval.
- The app is a planning tool, not a therapist, diagnostic service, or medical
  device.
- Keep future advertising, entitlement, and billing integrations separate from
  core planning logic.

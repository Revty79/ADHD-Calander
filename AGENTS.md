# ADHD Calendar Agent Instructions

Read the relevant files in `docs/` before editing product behavior,
persistence, navigation, or user-facing text.

## Product Rules

1. Never use shame-based or punitive language.
2. Do not create broken-streak punishment.
3. Do not emphasize overdue-task counts with alarming visual treatment.
4. Never delete, move, complete, or reschedule important user data silently.
5. Important actions must be reversible wherever practical.
6. Fixed appointments must never be moved automatically.
7. Recovery Mode must reduce future workload rather than simply move everything
   to tomorrow.
8. Encouragement must be based on recorded user actions.
9. Core task-management features must work offline.
10. Do not add external APIs, cloud services, analytics services, or AI services
    without approval.
11. Prefer simple, testable architecture over speculative abstraction.
12. Do not expand assigned scope without approval.
13. Accessibility is a requirement, not a later enhancement.
14. Avoid collecting information that is not necessary for the product.
15. The application is a planning tool, not a therapist, diagnostic service, or
    medical device.

## Coding Instructions

- State important assumptions in documentation or the final handoff.
- Implement only the assigned scope.
- Avoid unrelated refactoring.
- Keep raw SQL inside the database layer, migrations, or tests.
- Add or update tests for persistence, date handling, and user-visible behavior.
- Run formatting, linting, type checks, tests, and `npm run validate` before
  handoff when the environment permits it.
- Document every schema migration in `docs/data-model.md`.
- Summarize user-visible changes in the final response.
- Record unresolved product questions in `docs/decision-log.md` or the relevant
  requirements document.

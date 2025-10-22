# Changelog

## Latest Updates

- Introduced a shared sync status context that keeps connectivity, queue length, and last-sync timestamps in sync across the UI for clearer offline workflows.
- Added a guarded logout flow that waits for pending sync activity (with retry and override options) before signing users out.
- Hardened modal handling around PWA authentication redirects to prevent unintended settings screens from opening post-login.

## History (Lite)

| Date   | Change |
|--------|--------|
| 2025-10 | NIWA integration with LAT datum, enhanced error handling, production logging optimization |
| 2025-10 | Deterministic encryption reintroduced + background migration UI pill |
| 2025-10 | Legacy passphrase encryption removed, tests cleaned |
| 2025-09 | Import/export & performance smoke test added |
| 2025-08 | Initial PWA, lunar calendar, trip logging foundation |

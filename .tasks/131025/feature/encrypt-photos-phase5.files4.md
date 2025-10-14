Phase 5 Iteration 4 - modified files

1. scripts/migrate-legacy-photos.js - migration runner (encryption, per-user derivation, upload, Firestore updates)
2. scripts/inventory-legacy-photos.js - inventory helper (pagination, CSV/JSON output)
3. scripts/configure-firebase.js - admin SDK init helper
4. scripts/validate-migration-sample.js - NEW validation script to sample & attempt decrypt
5. RUNBOOKS/MIGRATE_LEGACY_PHOTOS.md - operator runbook and safety checklist
# Phase 5 — iteration 4: modified files summary

Short list of files/artefacts updated during Phase 5 iteration 4 and brief purpose:

- `scripts/migrate-legacy-photos.js` — Integrated per-user key derivation (pulling salt/email from `users` doc and using server-side PBKDF2 with pepper) so migrated photos can use same AES-GCM keys as clients when available. Added option to delete legacy storage objects and to clear legacy Firestore fields.
- `scripts/configure-firebase.js` — (used) admin SDK loader for operator scripts.

Notes:
- This iteration aligns server-side migration with client encryption where possible. Operators must ensure `users` documents contain the expected per-user salt and `email` fields if they want per-user derivation to work.
- The script still supports operator-provided `--encrypt-key` for testing or alternative workflows.
# Phase 5 — iteration 4: modified files summary

Short list of files changed during Phase 5 iteration 4 (populate after implementation):

- _TBD_

Notes:
- Update this summary once iteration 4 work completes to reflect actual modifications.

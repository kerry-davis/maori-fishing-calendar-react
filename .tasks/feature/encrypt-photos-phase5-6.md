## Phase 5 Tasks for feature/encrypt-photos (Iteration 6)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Harden `migrate-legacy-photos.js`: surface per-user key derivation failures (log + progress status), prevent plaintext uploads to `enc_photos` paths, and choose explicit handling (skip vs operator key).
4. Align storage metadata flags with client expectations, ensure legacy blobs are deleted only after successful uploads, and extend progress reporting with failure categories and per-user breakdown.
5. Enhance `validate-migration-sample.js` to reuse per-user derivation where available, report skipped/untestable samples, and summarize success vs failure counts.
6. Update `RUNBOOKS/MIGRATE_LEGACY_PHOTOS.md` with troubleshooting for missing salts/emails, validation outcomes, and an end-to-end staging verification checklist (including UI spot checks).
7. Execute the staging verification flow (dry-run or seeded dataset), capture findings, and ticket any UI regressions or migration anomalies.
8. Add or update automated dry-run scripts/tests covering derivation success/failure, metadata integrity, and legacy cleanup.
9. Create `.tasks/feature/encrypt-photos-phase5.files6.md` summarizing modified files in short form.

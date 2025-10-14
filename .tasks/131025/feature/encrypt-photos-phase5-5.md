## Phase 5 Tasks for feature/encrypt-photos (Iteration 5)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Harden migration tooling: surface per-user key derivation failures loudly and provide fallback guidance (skip or operator key).
4. Align storage metadata flags (`encrypted`, `originalMime`, etc.) with client expectations; add assertions/tests for parity.
5. Enhance validation script to report un-testable samples and summarize success vs skipped counts.
6. Expand automated tests or dry-run pipelines covering derivation success/failure, metadata integrity, and legacy cleanup.
7. Update runbook with troubleshooting steps for missing salts/emails and validation outcomes.
8. Confirm end-to-end migration flow on a staging dataset, including UI verification post-migration.
9. Create `.tasks/feature/encrypt-photos-phase5.files5.md` summarizing modified files in short form.

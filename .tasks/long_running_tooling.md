Long-running migration tooling notes

- Always run inventory first: `scripts/inventory-legacy-photos.js --dry-run --out inventory.json`
- Use `scripts/migrate-legacy-photos.js` with `--dry-run` and a `--progress-file` to test a small batch.
- Validate sample uploads with `scripts/validate-migration-sample.js` using either an operator key or per-user derived key.
- Progress file contains per-document outcomes and per-user stats under `progress.stats.users`.
- Keep operator runs logged and runbooks saved under `RUNBOOKS/`.

Long-running tooling (tests, docker compose, migrations, etc.) must always be invoked with sensible timeouts or in non-interactive batch mode. Never leave a shell command waiting indefinitely—prefer explicit timeouts, scripted runs, or log polling after the command exits.
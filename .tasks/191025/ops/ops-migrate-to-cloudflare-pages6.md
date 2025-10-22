1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Add Vitest tests for functions/api/niwa-tides.ts: OPTIONS preflight, GET success with lng→long mapping, missing NIWA_API_KEY, non-JSON and error responses, CORS headers present.
4. Update wrangler.toml to include a compatibility_date pinned to current CF runtime.
5. Tighten types in functions/api/niwa-tides.ts: define Env interface (env: { NIWA_API_KEY: string }) and replace any usage in onRequest signature.
6. Create .tasks/ops/ops-migrate-to-cloudflare-pages.files6.md listing in short form the files changed.

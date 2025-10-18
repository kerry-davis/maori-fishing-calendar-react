# Task list – ops/migrate-to-cloudflare-pages (set 2)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Update `.github/workflows/deploy-cloudflare-pages.yml` so that the Cloudflare project secret key name is consistent throughout (use `CLOUDFLARE_PAGES_PROJECT`) and remove the `VITE_NIWA_API_KEY` export from the build step to avoid leaking secrets.
4. Modify `functions/api/niwa-tides.ts` to use the Cloudflare Pages Functions handler signature (`export async function onRequest({ request, env })`) while preserving existing logic and logging.
5. Adjust `DEPLOYMENT.md` to document the finalized secret names used by the workflow (matching step 3).
6. Verify `_redirects` still points to `/*  /index.html  200` and update if required (no change expected).
7. Create `.tasks/ops/migrate-to-cloudflare-pages.files2.md` listing files touched in short form.

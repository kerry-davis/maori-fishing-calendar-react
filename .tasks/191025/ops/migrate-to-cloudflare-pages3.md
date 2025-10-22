# Task list – ops/migrate-to-cloudflare-pages (set 3)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Update `DEPLOYMENT.md` so the Cloudflare Pages prerequisites explicitly include the `NIWA_API_KEY` secret (server-side only) and clarify where it is consumed.
4. Review `.github/workflows/deploy-cloudflare-pages.yml` for any lingering references to `NIWA_API_KEY` in the build environment and add an inline comment explaining that the key is injected only for the Pages Function.
5. Confirm `functions/api/niwa-tides.ts` reads the key solely from `env.NIWA_API_KEY`; add a brief comment near the assignment to emphasise the server-side scope.
6. Create `.tasks/ops/migrate-to-cloudflare-pages.files3.md` listing files touched in short form.

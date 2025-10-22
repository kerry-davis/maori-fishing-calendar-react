# Task list – ops/migrate-to-cloudflare-pages (set 1)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Remove Vercel-specific artifacts from the codebase (`vercel.json`, `.github/workflows/promote-vercel-to-github-preview.yml`, `.github/workflows/promote-vercel-to-github-production.yml`).
4. Create a new workflow file `.github/workflows/deploy-cloudflare-pages.yml` that builds the project and deploys to Cloudflare Pages, producing Preview deployments for pull requests and Production deployments for main.
5. Implement the Cloudflare Pages Function at `functions/api/niwa-tides.ts`, porting logic from `api/niwa-tides.ts` with identical NIWA query handling, error behaviour, and CORS headers.
6. Update any configuration needed for the new function (e.g., ensure `VITE_NIWA_PROXY_URL` continues pointing at `/api/niwa-tides`, document required env vars in existing config files).
7. Add SPA fallback routing by creating `public/_redirects` containing `/*  /index.html  200` (or updating existing routing config).
8. Update project documentation (e.g., `DEPLOYMENT.md`) to reflect the Cloudflare Pages deployment process instead of Vercel.
9. Create `.tasks/ops/migrate-to-cloudflare-pages.files1.md` listing files touched in short form.

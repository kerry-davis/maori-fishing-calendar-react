1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Verify Cloudflare Pages setup: confirm wrangler.toml pages_build_output_dir and presence of functions/api/niwa-tides.ts.
4. Update .github/workflows/deploy-cloudflare-pages.yml to include actions/checkout@v4 in deploy-preview and deploy-production jobs before pages-action.
5. Commit changes on ops/migrate-to-cloudflare-pages and push.
6. Trigger/monitor GitHub Actions deploy; ensure dist and functions directory are included.
7. Validate Cloudflare Pages → Project → Functions tab is present; confirm function routes.
8. Smoke-test /api/niwa-tides on preview and production; check logs for errors.
9. Create .tasks/ops-migrate-to-cloudflare-pages.files1.md with a short list of files changed.

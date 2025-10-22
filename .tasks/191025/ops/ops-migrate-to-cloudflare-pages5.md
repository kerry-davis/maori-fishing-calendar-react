1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Edit wrangler.toml: ensure pages_build_output_dir = "dist".
4. Ensure functions/api/niwa-tides.ts complies with Cloudflare Pages Functions (export onRequest, use env.NIWA_API_KEY, CORS headers intact).
5. Update .github/workflows/deploy-cloudflare-pages.yml: add actions/checkout@v4 to deploy-preview and deploy-production jobs before cloudflare/pages-action.
6. Verify workflow artifact usage keeps directory: dist for upload/download and pages-action inputs.
7. Create .tasks/ops/ops-migrate-to-cloudflare-pages.files5.md listing in short form the files changed.

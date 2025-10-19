1. Edit wrangler.toml: set pages_build_output_dir = "dist".
2. Ensure functions/api/niwa-tides.ts exists and is compatible with Cloudflare Pages Functions routing.
3. Update .github/workflows/deploy-cloudflare-pages.yml: add actions/checkout@v4 to deploy-preview and deploy-production jobs before cloudflare/pages-action.

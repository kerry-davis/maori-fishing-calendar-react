# Files Touched - migrate-to-cloudflare-pages (set 3)

## Updated Files
- `DEPLOYMENT.md` - Added NIWA_API_KEY to prerequisites with server-side scope clarification
- `.github/workflows/deploy-cloudflare-pages.yml` - Added explanatory comments about NIWA_API_KEY injection
- `functions/api/niwa-tides.ts` - Added comments emphasizing server-side scope of NIWA_API_KEY

## Summary
Total files updated: 3
Files touched: 3

Changes:
- Documented NIWA_API_KEY as a required secret under "NIWA API Configuration (Server-side only)"
- Clarified that NIWA_API_KEY is injected only into Cloudflare Pages Functions, not into build environment
- Added comments to function handler explaining NIWA_API_KEY scope and security
- Emphasized security boundary between client-side (Firebase) and server-side (NIWA) credentials

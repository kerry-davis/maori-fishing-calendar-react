wrangler.toml - Added compatibility_date = "2024-10-19" for Cloudflare runtime
functions/api/niwa-tides.ts - Added Env interface and tightened onRequest signature types
test/functions-niwa-tides.test.ts - Added comprehensive Vitest tests for Pages Function (OPTIONS preflight, GET success with lng→long mapping, missing NIWA_API_KEY, non-JSON/error responses, CORS headers)
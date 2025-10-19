# Māori Fishing Calendar (React PWA)

Modern offline-first fishing planner grounded in traditional Māori lunar knowledge. Built as a lightweight, testable React + Vite + TypeScript Progressive Web App with deterministic client‑side field obfuscation (encryption) for selected user data.

---
## Latest Updates
* Introduced a shared sync status context that keeps connectivity, queue length, and last-sync timestamps in sync across the UI for clearer offline workflows.
* Added a guarded logout flow that waits for pending sync activity (with retry and override options) before signing users out.
* Hardened modal handling around PWA authentication redirects to prevent unintended settings screens from opening post-login.

---
## 1. Purpose & Scope
Helps anglers plan and review fishing activity using lunar phases, weather, and personal trip history while respecting and acknowledging Māori cultural knowledge. The app is personal-use focused: single authenticated user context per browser profile (no multi-tenant org features).

---
## 2. Key Features
| Domain | Capability |
| ------ | ---------- |
| Lunar | Māori lunar phase calendar & current moon info |
| Trips | Create, edit, merge local guest data, log catches & weather |
| Gear  | Tackle box & gear type management |
| Weather | Capture / attach conditions to trips (manual + service integration) |
| Analytics | Basic success pattern exploration (charts) |
| Import / Export | CSV / zipped data flows & legacy migration scripts |
| Offline | Local persistence + queued writes + PWA install |
| Encryption | Deterministic field-level obfuscation (AES-GCM) for sensitive strings |

---
## 3. Architecture Overview
Client-only React application (no custom backend) leveraging Firebase (Auth + Firestore + Storage). App logic centralizes around a data service (`firebaseDataService`) that:
* Initializes guest mode → switches to user context post-auth
* Manages offline queue (`syncQueue_{userId}`) and id mapping (`idMapping_*` keys)
* Applies field encryption on write & decryption on read
* Performs background migration (plaintext → encrypted) in batches

High-level flow:
```
AuthContext ──(login/logout)──▶ firebaseDataService.switchToUser()
                                 │
                                 ├─ encryptionService.setDeterministicKey()
                                 ├─ mergeLocalDataForUser()
                                 └─ startBackgroundEncryptionMigration()

UI Components ◀── hooks / contexts ──▶ Services (weather, lunar, photoZip, export/import)
```

---
## 4. Technology Stack (Pinned Ranges)
| Layer | Tech | Notes |
| ----- | ---- | ----- |
| Runtime | Node (dev) / Browser | Offline-first PWA |
| Framework | React ^19 + Vite ^7 | Fast HMR, TS build separation |
| Language | TypeScript ~5.8 | Strict-enough for app scale |
| Styling | Tailwind CSS 4.x | Utility-first; custom CSS vars for themes |
| Data | Firebase Firestore / Auth / Storage | Web SDK ^12.x |
| Worker | Service Worker via `vite-plugin-pwa` | Caching & updates |
| Charts | Chart.js 4 + react-chartjs-2 | Analytics visuals |
| Tests | Vitest 3 + jsdom | Includes perf smoke test |
| Bundling | Vite build (ESM) | Production config variant `vite.config.production.ts` |

---
## 5. Client-Side Field Encryption (Deterministic)
See `SECURITY.md` for full threat model.
* AES-GCM 256, ciphertext prefix: `enc:v1:`
* Key derivation: `PBKDF2( email | pepper , perUserSalt , 60k , SHA-256)`
* Pepper: `VITE_KEY_PEPPER` (build-time secret). Rotation requires planned re-encryption.
* Encrypted collections / fields: trips(water, location, companions, notes), weatherLogs(sky, windCondition, windDirection), fishCaught(species, length, weight, time, details, gear[]), tackleItems(name, brand, colour)
* Background migration auto-runs post-auth; progress pill displayed via `EncryptionMigrationStatus`.
* Treat as obfuscation, not high-assurance E2EE (email entropy is low).

### 5.1 Pepper & Per-User Salt Sync (Important)
To ensure the same encryption key across devices and deployments:
- Pepper (build-time): `VITE_KEY_PEPPER` must be identical across environments (Prod, Preview, Local) if you want consistent decrypts. If not set, the app defaults to `default-pepper`.
- Per-user salt (runtime): Stored in localStorage as `enc_salt_<uid>` and mirrored in Firestore at `userSettings/<uid>.encSaltB64`.

Flow on login:
1) App reads `userSettings/<uid>.encSaltB64` (or `encSalt`) and writes it to localStorage if missing/different
2) If none exists anywhere, it generates a salt and persists to both localStorage and Firestore
3) Key is derived as `PBKDF2(email | VITE_KEY_PEPPER, encSaltB64, 60000, SHA-256)`

Verify:
- After login, check Firestore doc `userSettings/<uid>` contains `encSaltB64`
- Ensure `VITE_KEY_PEPPER` is set in Vercel → Project → Settings → Environment Variables (ideally for Production and Preview) with the exact same value

Caution:
- Changing `VITE_KEY_PEPPER` without migration will make existing ciphertext unreadable. Plan rotations with dual-decrypt or re-encryption scripts.

---

## 6. External Services & Integrations

### 6.1 Tide Data (NIWA & Open-Meteo)
The app provides tide forecasts with automatic provider fallback:

**Primary Provider: NIWA (National Institute of Water and Atmospheric Research)**
- **Source**: Official NZ tide data (most accurate for New Zealand waters)
- **Datum**: Local Astronomical Tide (LAT) - aligns with NIWA's public tides.niwa.co.nz
- **Coverage**: New Zealand waters (lat: -55° to -25°, lon: 165° to 185°)
- **Latency**: ~7KB payload with 5-day buffer for timezone conversion reliability
- **Fallback**: Seamlessly switches to Open-Meteo if NIWA proxy unavailable

**Secondary Provider: Open-Meteo (Enhanced NZ Support)**
- **Source**: Global marine API with NZ harbour optimizations
- **Reliability**: Always available as backup provider
- **Accuracy**: Good for planning with automatic provider prioritization

**Technical Implementation:**
- Proxy-only architecture (no client-side API keys for security)
- Smart timezone handling (UTC+NZ time conversion with edge case protection)
- Graceful error handling with user-friendly messages
- Height units in meters, times in NZ timezone (Pacific/Auckland)

**Integration Notes:**
- Heights are LAT-based (compatible with NIWA's official tide tables)
- **Height Reference**: LAT is approximately 1.4m above Mean Sea Level (MSL) - explains why heights shifted from previous integrations
- No datum conversion required for consumer applications
- Provider selection is automatic based on location and availability
- Proxy deployed as serverless function (Vite/Next.js compatible)

### 6.2 Weather Service
Manual weather logging with optional Open-Meteo integration for:
- Historical weather data at fishing locations
- Wind conditions, sky coverage, and atmospheric pressure
- Temperature and humidity tracking
- Weather-tide correlation analysis

---

## 7. Quick Start
```bash
git clone <repo>
cd maori-fishing-calendar-react
npm install

# Development
npm run dev

# Tests (single run vs watch)
npm test        # interactive
npm run test:run

# Production build
npm run build
npm run preview
```

Environment example (`.env` – do NOT commit):
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_KEY_PEPPER=some-long-random-pepper
```

---
## 8. Scripts
| Script | Purpose |
| ------ | ------- |
| dev | Vite dev server |
| build | Type check then production build |
| build:skip-types | Fast build ignoring TS errors (CI fallback) |
| build:prod | Shell script with production flags / extra steps |
| preview | Preview built output |
| test / test:run | Vitest (UI/watch vs single) |
| test:pwa | Scripted PWA validation flow |
| test:migration | Test legacy data migration tooling |
| verify:compatibility | Validates data shape compatibility post changes |

Supporting utility scripts under `scripts/` handle: adding test data, migration validation, image compression, secret scanning, preview deploy.

---
## 9. Testing Strategy
| Area | Coverage |
| ---- | -------- |
| Encryption | Deterministic key + migration helpers |
| Data Service | ID mapping, merge logic, validation, idempotent import |
| Error UX | Friendly Firebase error mapping |
| Performance | Smoke test for image import / caching |

Run:
```bash
npm run test:run
```
Add new tests colocated in `src/test/`. Prefer fast, deterministic tests; mock Firebase network where feasible.

---
## 10. Deployment

### 10.1 Cloudflare Pages (Primary Deployment)
The application is configured for deployment to Cloudflare Pages via GitHub Actions. This is the recommended deployment method.

#### Quick Setup:
1. **Create Cloudflare Pages project** (manual setup, no Git integration)
2. **Add GitHub secrets** (see DEPLOYMENT.md for complete list)
3. **Push to branch** → Automatic deployment!

#### Live URL:
`https://maori-fishing-calendar-react.pages.dev`

#### GitHub Actions Workflow:
- **File**: `.github/workflows/deploy-cloudflare-pages.yml`
- **Triggers**: Pull requests (preview) and push to `main` (production)
- **Features**: Concurrency to avoid duplicate runs, Pages Functions auto-detection

#### Manual Deployment (if needed):
```bash
# Build locally
npm run build

# Deploy via Wrangler (requires CLOUDFLARE_API_TOKEN)
npx wrangler pages deploy dist --project-name maori-fishing-calendar-react
```

### 10.2 Alternative Deployment Options
See `DEPLOYMENT.md` for other hosting options (Netlify, GitHub Pages, traditional servers).

### 10.1 Firebase Storage CORS (for encrypted photos)
If you use Firebase Storage for photo binary data, configure CORS to allow your app origins. Example `cors.json` used in this repo:

```
[
  {
    "origin": [
      "http://localhost:5173",
      "https://maori-fishing-calendar-react.web.app",
      "https://maori-fishing-calendar-react.firebaseapp.com",
      "https://maori-fishing-calendar-react.pages.dev"
    ],
    "method": ["GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE"],
    "responseHeader": ["*"],
    "maxAgeSeconds": 3600
  }
]
```

Apply and verify (replace bucket if yours differs):
- Determine bucket: `gsutil ls -p <project-id>` → expect `gs://<project-id>.firebasestorage.app/`
- Set CORS: `gsutil cors set cors.json gs://maori-fishing-calendar-react.firebasestorage.app`
- Get CORS: `gsutil cors get gs://maori-fishing-calendar-react.firebasestorage.app`

Notes:
- Origins must not include trailing slashes; match scheme/host/port exactly
- Add Vercel Preview URLs explicitly if you need previews to access Storage (wildcards aren’t supported)
- Browsers cache preflight per `maxAgeSeconds`; hard refresh or wait up to that duration to see changes

Vercel Preview guidance:
- Preview deploys live at unique URLs like `https://<commit>-<project>-<hash>.vercel.app`
- Because Google Cloud Storage CORS doesn’t support wildcard subdomains in `origin`, you must add each preview origin you need to `cors.json` and re-apply CORS.
- Fast workflow options:
  1) Keep previews read-only for Storage (don’t fetch from Storage in previews), or
  2) Manually add specific preview origins you want to test, e.g.:
     - `https://maori-fishing-calendar-react-git-feature-branchname-user.vercel.app`
     - `https://maori-fishing-calendar-react-git-pr-123-user.vercel.app`
  3) Use Firebase Hosting preview channels instead (stable subdomains easier to list).

After editing `cors.json`, re-run:
```
gsutil cors set cors.json gs://maori-fishing-calendar-react.firebasestorage.app
gsutil cors get gs://maori-fishing-calendar-react.firebasestorage.app
```

---
## 11. Data & Migration Notes
* Guest mode uses local storage + IndexedDB; on auth merge occurs then local cleared (except visible continuity). 
* Encryption migration: resumable per-collection state in `localStorage` (`encMigrationState_*`).
* Offline writes stored in queue and replayed when connectivity resumes; encryption applied before enqueue if key ready.

---
## 12. Friendly Firebase Error Messages
Utility: `src/utils/firebaseErrorMessages.ts` provides context-aware mapping.
Example:
```ts
try { /* firebase op */ } catch (e) {
  const msg = mapFirebaseError(e, 'login');
  setError(msg);
}
```
Contexts: `login`, `register`, `google`, `generic`. Fallback includes offline hints.

---
## 13. Contributing (Internal Guidelines)
1. Keep PRs focused & under ~400 LOC diff when possible.
2. Add/adjust tests for changed logic (no silent behavior drift).
3. Run `npm run test:run` before pushing.
4. Avoid introducing runtime-only secret dependencies—everything must work with provided Firebase config + pepper.
5. Document noteworthy architectural decisions in `MIGRATION_SUMMARY.md` or a new ADR.

---
## 14. Troubleshooting
| Symptom | Likely Cause | Fix |
| ------- | ------------ | --- |
| Ciphertext shows in UI | Pepper mismatch / rotation | Restore old build & re-encrypt, or update docs for rotation plan |
| Migration pill never appears | User has no plaintext docs OR key not ready | Confirm `encryptionService.isReady()` & existing plaintext |
| Offline queue stuck | Network offline or permission issue | Inspect `syncQueue_<userId>` and console logs |
| PWA not updating | SW cached | Hard refresh / check `vite-plugin-pwa` manifest changes |
| Photo decrypt fails (OperationError) | Different salt or pepper per device | Ensure `userSettings/<uid>.encSaltB64` exists and `VITE_KEY_PEPPER` matches across envs |
| Trip log photos missing until edit modal opens | Legacy inline photos lacked preview fallback | Update to latest build (uses inline/URL fallback) or ensure `fish.photo`/`photoUrl` populated |
| IndexedDB “VersionError” on load | Cached DB schema newer than requested version | Latest build auto-recovers by deleting the stale DB; refresh once more if seen |
| Storage blocked by CORS | Missing origin in bucket CORS | Add your origin to `cors.json`, re-apply with `gsutil cors set`, and retry after cache window |

---
## 15. Changelog (Lite)
| Date | Change |
| ---- | ------ |
| 2025-10 | NIWA integration with LAT datum, enhanced error handling, production logging optimization |
| 2025-10 | Deterministic encryption reintroduced + background migration UI pill |
| 2025-10 | Legacy passphrase encryption removed, tests cleaned |
| 2025-09 | Import/export & performance smoke test added |
| 2025-08 | Initial PWA, lunar calendar, trip logging foundation |

---
---
## 16. Cultural Acknowledgement |
This project incorporates traditional Māori lunar knowledge (maramataka) for fishing guidance. Use respectfully; do not commercialize cultural data without appropriate consultation and acknowledgement.

---
## 17. License / Usage
No explicit OSS license defined here. Assume “All Rights Reserved” by default pending cultural guidance. If you intend broader distribution, add a clear LICENSE file and cultural usage statement.

---
## 18. Future Enhancements (Backlog Candidates)
* Pepper rotation with dual-decrypt window
* Configurable blind indexes for search on encrypted fields
* Richer analytics (seasonal heatmaps)
* Optional stronger user passphrase mode (E2EE profile)
* Offline-first image capture & progressive upload

---
## 19. Maintainer Notes
Follow `agent_rules.md`:
* Work doggedly – keep iterative momentum
* Verify with tests (`vitest`) after each substantive change
* Add logging before guessing during debugging
* Keep `README.md` + a future `HANDOFF.md` current for continuity

---
_Last updated: 2025-10-14_

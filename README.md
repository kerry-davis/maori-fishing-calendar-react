# Māori Fishing Calendar (React PWA)

Modern offline-first fishing planner grounded in traditional Māori lunar knowledge. Built as a lightweight, testable React + Vite + TypeScript Progressive Web App with deterministic client‑side field obfuscation (encryption) for selected user data.

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

---
## 6. Quick Start
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
## 7. Scripts
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
## 8. Testing Strategy
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
## 9. Deployment
See `DEPLOYMENT.md` & `DEPLOYMENT_CHECKLIST.md`.
High-level:
1. Ensure secrets configured (Firebase vars + `VITE_KEY_PEPPER`).
2. `npm run build:prod`
3. Deploy `dist/` to static hosting (Firebase Hosting / Netlify / Vercel).
4. Verify PWA install & service worker update path.

---
## 10. Data & Migration Notes
* Guest mode uses local storage + IndexedDB; on auth merge occurs then local cleared (except visible continuity). 
* Encryption migration: resumable per-collection state in `localStorage` (`encMigrationState_*`).
* Offline writes stored in queue and replayed when connectivity resumes; encryption applied before enqueue if key ready.

---
## 11. Friendly Firebase Error Messages
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
## 12. Contributing (Internal Guidelines)
1. Keep PRs focused & under ~400 LOC diff when possible.
2. Add/adjust tests for changed logic (no silent behavior drift).
3. Run `npm run test:run` before pushing.
4. Avoid introducing runtime-only secret dependencies—everything must work with provided Firebase config + pepper.
5. Document noteworthy architectural decisions in `MIGRATION_SUMMARY.md` or a new ADR.

---
## 13. Troubleshooting
| Symptom | Likely Cause | Fix |
| ------- | ------------ | --- |
| Ciphertext shows in UI | Pepper mismatch / rotation | Restore old build & re-encrypt, or update docs for rotation plan |
| Migration pill never appears | User has no plaintext docs OR key not ready | Confirm `encryptionService.isReady()` & existing plaintext |
| Offline queue stuck | Network offline or permission issue | Inspect `syncQueue_<userId>` and console logs |
| PWA not updating | SW cached | Hard refresh / check `vite-plugin-pwa` manifest changes |

---
## 14. Changelog (Lite)
| Date | Change |
| ---- | ------ |
| 2025-10 | Deterministic encryption reintroduced + background migration UI pill |
| 2025-10 | Legacy passphrase encryption removed, tests cleaned |
| 2025-09 | Import/export & performance smoke test added |
| 2025-08 | Initial PWA, lunar calendar, trip logging foundation |

---
## 15. Cultural Acknowledgement
This project incorporates traditional Māori lunar knowledge (maramataka) for fishing guidance. Use respectfully; do not commercialize cultural data without appropriate consultation and acknowledgement.

---
## 16. License / Usage
No explicit OSS license defined here. Assume “All Rights Reserved” by default pending cultural guidance. If you intend broader distribution, add a clear LICENSE file and cultural usage statement.

---
## 17. Future Enhancements (Backlog Candidates)
* Pepper rotation with dual-decrypt window
* Configurable blind indexes for search on encrypted fields
* Richer analytics (seasonal heatmaps)
* Optional stronger user passphrase mode (E2EE profile)
* Offline-first image capture & progressive upload

---
## 18. Maintainer Notes
Follow `agent_rules.md`:
* Work doggedly – keep iterative momentum
* Verify with tests (`vitest`) after each substantive change
* Add logging before guessing during debugging
* Keep `README.md` + a future `HANDOFF.md` current for continuity

---
_Last updated: 2025-10-05_

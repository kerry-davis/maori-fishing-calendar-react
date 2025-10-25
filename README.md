# Māori Fishing Calendar (React PWA)

Modern offline-first fishing planner grounded in traditional Māori lunar knowledge.

## Quick links

- [Architecture overview](docs/architecture/OVERVIEW.md)
- [Technology stack](docs/architecture/TECH_STACK.md)
- [Data model & ERDs](docs/architecture/DATA_MODEL.md)
- [Security & encryption](docs/security/SECURITY.md)
- Tide integration & NIWA proxy: [Tide comparison](docs/tide/TIDE_COMPARISON_ANALYSIS.md), [NIWA proxy deployment](docs/deployment/NIWA_PROXY_DEPLOYMENT.md)
- Deployment: [Deployment](docs/deployment/DEPLOYMENT.md), [Checklist](docs/deployment/DEPLOYMENT_CHECKLIST.md)
- Data migration: [Migration guide](docs/migration/MIGRATION_GUIDE.md), [Migration summary](docs/migration/MIGRATION_SUMMARY.md), [Migrate your data (end‑user)](docs/migration/MIGRATE_YOUR_DATA.md)
- [Testing](docs/ops/TESTING.md)
- [Troubleshooting](docs/ops/TROUBLESHOOTING.md)
- [Changelog](docs/ops/CHANGELOG.md)
- [Scripts](docs/ops/SCRIPTS.md)

## Purpose & Scope
Helps anglers plan and review fishing activity using lunar phases, weather, and personal trip history while respecting Māori cultural knowledge. Single-user focus per browser profile.

## Key Features
| Domain | Capability |
| ------ | ---------- |
| Lunar | Māori lunar phase calendar & current moon info |
| Trips | Create, edit, merge local guest data, log catches & weather |
| Gear  | Tackle box & gear type management |
| Weather | Capture conditions (manual + integration) |
| Analytics | Basic success pattern exploration (charts) |
| Photos | Encrypted photo storage (Firebase Storage) and gallery; included in export/import |
| Import / Export | CSV / zipped data flows & legacy migration |
| Offline | Local persistence + queued writes + PWA install |
| Encryption | Deterministic field-level obfuscation (AES-GCM) |

## Quick Start

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

## Deployment & Operations
- Deployment guides: [Deployment](docs/deployment/DEPLOYMENT.md), [Checklist](docs/deployment/DEPLOYMENT_CHECKLIST.md)
- [Firebase Storage CORS](docs/deployment/FIREBASE_STORAGE_CORS.md)
- [Logging guidelines](docs/logging/LOGGING_GUIDELINES.md)
- More: see [docs/](docs/)

## Cultural Acknowledgement
This project incorporates traditional Māori lunar knowledge (maramataka) for fishing guidance. Use respectfully; do not commercialize cultural data without appropriate consultation and acknowledgement.

## License / Usage
No explicit OSS license defined here. Assume “All Rights Reserved” by default pending cultural guidance. If you intend broader distribution, add a clear LICENSE file and cultural usage statement.

## Roadmap
See [ROADMAP](docs/architecture/ROADMAP.md)

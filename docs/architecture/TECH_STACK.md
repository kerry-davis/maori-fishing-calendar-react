# Technology Stack

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

# Scripts

| Script | Purpose |
| ------ | ------- |
| dev | Vite dev server |
| build | Type check then production build |
| build:skip-types | Fast build ignoring TS errors (CI fallback) |
| build:prod | Shell script with production flags / extra steps |
| preview | Preview built output |
| dev:cf | Run Cloudflare Pages dev server locally |
| deploy:preview | Deploy preview build via script |
| test / test:run | Vitest (UI/watch vs single) |
| test:pwa | Scripted PWA validation flow |
| test:migration | Test legacy data migration tooling |
| verify:compatibility | Validates data shape compatibility post changes |

Supporting utilities live under `scripts/`.

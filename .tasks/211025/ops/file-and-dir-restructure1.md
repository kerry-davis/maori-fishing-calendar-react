1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Confirm branch ops/file-and-dir-restructure; record a clean baseline: npm run lint && npm run test:run && npm run build.
4. Add tsconfig path aliases (@app/*, @shared/*, @features/*); mirror in vite.config.ts and vite.config.production.ts; keep legacy import paths temporarily.
5. Qwen Coder Plus runbook: batch size ≤ 20 files per PR, use git mv to preserve history, only update imports/paths; after each batch run npm run lint && npm run test:run && npm run build.
6. Move src/App.tsx and src/main.tsx to src/app; move index.css to src/app/styles/global.css; update imports; verify after the batch.
7. Move contexts to app/providers or shared/context; move hooks/utils/services/types/assets to shared/*; verify after each batch.
8. Extract domain-specific components from src/components into src/features/<feature>/components; keep generic components in shared/ui; verify.
9. Reorganize/co-locate tests as needed; update Vitest globs if paths change; ensure Cypress remains unaffected.
10. Remove temporary compatibility barrels and legacy aliases; run full checks and a production preview.
11. Create file .tasks/ops/file-and-dir-restructure.files1.md with a short list of the files changed.

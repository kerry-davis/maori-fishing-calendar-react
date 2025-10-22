1) /home/pulsta/vscode/repo/maori-fishing-calendar-react
2) .tasks/long_running_tooling.md
3) Remove stray brace-named directories (artifacts) if present:
   - src/features/{auth,calendar,charts,debug,encryption,forms,layout,legend,modals,moon,weather,tide,pwa}
   - src/shared/{hooks,utils,services,types,assets}
4) Standardize all remaining test imports to aliases (@app, @shared, @features); replace legacy paths:
   - ../components/**/* → @features/**/*
   - ../contexts/**/* → @app/providers/**/*
   - ../services/**/* → @shared/services/**/*
   - ../hooks/**/* → @shared/hooks/**/*
   (Exclude node_modules, dist from search.)
5) Align test mocks to alias IDs (vi.mock keys and any require/import in tests should use the same alias as production code).
6) Targeted fixes (if still pending):
   - src/features/modals/__tests__/galleryModalNoPhoto.test.tsx → use @features/modals/GalleryModal and @app/providers/DatabaseContext
   - src/features/modals/__tests__/settingsDeleteAllProgress.test.tsx → use @features/modals/SettingsModal
   - src/features/auth/__tests__/*migration*.test.tsx → use @features/encryption/EncryptionMigrationStatus and alias services/providers
7) PWA config policy: confirm dev behaviour; set vite.config.ts VitePWA devOptions.enabled=false unless a dev service worker is explicitly desired; keep devOptions removed in production config.
8) Run: npm run lint && npm run test:run && npm run build; resolve any type/import/test issues.
9) Manual smoke test: npm run dev — verify app boot, PWA behaviour, and entry /src/app/main.tsx.
10) Create .tasks/ops/file-and-dir-restructure.files6.md with a short list of files changed in this task.

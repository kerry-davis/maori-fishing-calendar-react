1) /home/pulsta/vscode/repo/maori-fishing-calendar-react
2) .tasks/long_running_tooling.md
3) Remove stray brace-named dirs created during moves: src/features/{auth,calendar,charts,debug,encryption,forms,layout,legend,modals,moon,weather,tide,pwa} and src/shared/{hooks,utils,services,types,assets}.
4) Standardize all test imports to alias paths:
   - ../components/**/* → @features/**/*
   - ../contexts/**/* → @app/providers/**/*
   - ../services/**/* → @shared/services/**/*
   - ../hooks/**/* → @shared/hooks/**/*
5) Update specific broken tests to use aliases:
   - src/features/modals/__tests__/galleryModalNoPhoto.test.tsx (GalleryModal → @features/modals/GalleryModal, DatabaseContext → @app/providers/DatabaseContext)
   - src/features/modals/__tests__/settingsDeleteAllProgress.test.tsx (SettingsModal → @features/modals/SettingsModal)
   - src/features/auth/__tests__/*migration*.test.tsx (EncryptionMigrationStatus → @features/encryption/EncryptionMigrationStatus)
   - src/features/encryption/__tests__/encryptionUIIntegration.test.ts (use @shared/services/*, @app/providers/*, @shared/hooks/*)
6) Search and replace remaining legacy component paths: from 'src/components', '../components', '../../components', or '@/components' → aliases (@shared/components or @features/* as appropriate).
7) VitePWA dev toggle: set devOptions.enabled true in vite.config.ts and false in vite.config.production.ts.
8) Minifier: revert vite.config.production.ts to default esbuild (remove minify: 'terser') or add terser to devDependencies; prefer reverting for now.
9) Build/typecheck/tests: run npm run lint && npm run test:run && npm run build; fix any failures.
10) Manual smoke test: npm run dev (verify index.html loads /src/app/main.tsx, PWA registration ok).
11) Create .tasks/ops/file-and-dir-restructure.files3.md with a short list of files changed in this task.

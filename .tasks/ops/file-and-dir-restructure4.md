1) /home/pulsta/vscode/repo/maori-fishing-calendar-react
2) .tasks/long_running_tooling.md
3) Remove stray brace-named directories created during moves:
   - src/features/{auth,calendar,charts,debug,encryption,forms,layout,legend,modals,moon,weather,tide,pwa}
   - src/shared/{hooks,utils,services,types,assets}
4) Standardize all test imports to alias paths (@app, @shared, @features). Replace legacy paths:
   - ../components/**/* → @features/**/*
   - ../contexts/**/* → @app/providers/**/*
   - ../services/**/* → @shared/services/**/*
   - ../hooks/**/* → @shared/hooks/**/*
5) Fix known test files with old imports:
   - src/features/modals/__tests__/galleryModalNoPhoto.test.tsx
     • GalleryModal: @features/modals/GalleryModal
     • DatabaseContext: @app/providers/DatabaseContext
   - src/features/modals/__tests__/settingsDeleteAllProgress.test.tsx
     • SettingsModal: @features/modals/SettingsModal
   - src/features/auth/__tests__/*migration*.test.tsx
     • EncryptionMigrationStatus: @features/encryption/EncryptionMigrationStatus
   - src/features/encryption/__tests__/encryptionUIIntegration.test.{ts,tsx}
     • Use @shared/services/*, @app/providers/*, @shared/hooks/*
6) Verify app/provider/shared imports across features; replace any of:
   - 'src/components', '../components', '../../components', '@/components' with @shared/components or @features/* as appropriate.
7) VitePWA dev options: ensure production config has devOptions.enabled = false (or remove devOptions) and keep dev config disabled as-is.
8) Minifier: revert vite.config.production.ts to default esbuild (remove minify: 'terser') OR add terser to devDependencies; choose revert for now.
9) Run: npm run lint && npm run test:run && npm run build; fix any failures (types/imports).
10) Manual smoke test: npm run dev — verify app boots, PWA registration behavior, and main entry /src/app/main.tsx.
11) Create .tasks/ops/file-and-dir-restructure.files4.md with a short list of files changed in this task.

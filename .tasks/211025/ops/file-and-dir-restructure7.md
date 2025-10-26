1) /home/pulsta/vscode/repo/maori-fishing-calendar-react
2) .tasks/long_running_tooling.md
3) Verify and remove any remaining stray brace-named directories (artifacts):
   - src/features/{auth,calendar,charts,debug,encryption,forms,layout,legend,modals,moon,weather,tide,pwa}
   - src/shared/{hooks,utils,services,types,assets}
4) Standardize test imports to aliases (@app, @shared, @features) and align all vi.mock keys to the same alias IDs used in code.
5) Update remaining tests still using legacy paths (if any), including:
   - src/features/modals/__tests__/galleryModalNoPhoto.test.tsx → use @features/modals/GalleryModal, @app/providers/DatabaseContext
   - src/features/modals/__tests__/settingsDeleteAllProgress.test.tsx → use @features/modals/SettingsModal
   - src/features/auth/__tests__/*migration*.test.tsx → use @features/encryption/EncryptionMigrationStatus and alias services/providers
6) Global grep: replace 'src/components', '../components', '../../components', '@/components' with @shared/components or @features/* as appropriate (exclude node_modules, dist).
7) PWA policy: ensure vite.config.ts sets devOptions.enabled=false (unless dev SW explicitly required) and keep devOptions removed from vite.config.production.ts.
8) Confirm production build uses default esbuild minifier (no 'terser'); adjust if needed.
9) Run: npm run lint && npm run test:run && npm run build; fix any import/type/test failures.
10) Manual smoke test: npm run dev — verify app boots, PWA behavior, and entry /src/app/main.tsx.
11) Create .tasks/ops/file-and-dir-restructure.files7.md with a short list of the files changed.

1) /home/pulsta/vscode/repo/maori-fishing-calendar-react
2) .tasks/long_running_tooling.md
3) Update index.html to load app entry from /src/app/main.tsx instead of /src/main.tsx.
4) Update vitest.config.ts:
   - Add resolve.alias for @app → /src/app, @shared → /src/shared, @features → /src/features.
   - Point test.setupFiles to ./src/shared/__tests__/setup.ts.
5) Fix import in src/shared/components/ErrorBoundary.tsx to import Button from the local index (e.g. `from '.'` or `from './Button'`).
6) Fix imports in src/app/providers/DatabaseContext.tsx to use @shared/services/firebaseDataService and @shared/types.
7) Fix imports in src/app/providers/AuthContext.tsx:
   - Use @shared/services/firebase, @shared/services/encryptionService.
   - Use @shared/utils/{firebaseErrorMessages,userStateCleared,clearUserContext}.
   - Update dynamic import to `import('@shared/services/userSaltService')`.
8) Fix imports in src/app/providers/PWAContext.tsx to import usePWARegister from @shared/hooks/usePWARegister.
9) Bulk update feature module imports:
   - Replace `../UI/*` and `../UI` with `@shared/components` (and specific component paths if needed).
   - Replace `../../services/*` with `@shared/services/*`.
   - Replace `../../contexts/*` with `@app/providers`.
   Targeted files include (non‑exhaustive):
   - src/features/auth/{AuthButton.tsx,LoginModal.tsx,ProtectedRoute.tsx,SuccessToast.tsx}
   - src/features/layout/Header.tsx
   - src/features/modals/{SettingsModal.tsx,TackleBoxModal.tsx,TripDetailsModal.tsx,AnalyticsModal.tsx,DataMigrationModal.tsx}
   - src/features/pwa/{PWAInstallPrompt.tsx,PWAUpdateNotification.tsx,OfflineIndicator.tsx}
   - src/features/weather/{WeatherDisplay.tsx,WeatherForecast.tsx}
   - src/features/encryption/EncryptionMigrationStatus.tsx
10) Typecheck and build: `npm run build` (or `tsc -b` then `vite build`) and fix any remaining path/type errors.
11) Run tests: `npm run test:run` and address failures.
12) Dev smoke test: `npm run dev` to ensure app boots and PWA registration works.
13) Create .tasks/ops/file-and-dir-restructure.files2.md listing, in short form, the files changed in this task.

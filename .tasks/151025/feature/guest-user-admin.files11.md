Modified files for guest-user-admin11 feature:

- src/hooks/useSyncStatus.ts
- src/contexts/AuthContext.tsx
- src/components/Auth/SignOutConfirmation.tsx

Summary of changes:
- Exposed latest sync timestamp and in-flight status via context/hooks.
- Persisted and updated sync metadata for real-time UI reactivity.
- Enhanced sign-out confirmation modal to show last sync, progress indicator, block confirmation until sync completes or timeout, and handle retry/failure gracefully.
Modified files for guest-user-admin11:

- src/components/Auth/AuthButton.tsx
- src/components/Layout/Header.tsx

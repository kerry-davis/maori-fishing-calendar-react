# Phase 4 — iteration 1: modified files summary

Short list of files changed during Phase 4 iteration 1 and brief purpose:

- `src/components/Modals/FishCatchModal.tsx` — Refactored authenticated photo upload to read files as base64 data URLs and pass them unchanged to the data service; cleared `photoPath`/`photoUrl`/`encryptedMetadata` when replacing or removing photos to ensure service-controlled storage/encryption.
- `src/services/firebaseDataService.ts` — (Reviewed) Ensure `ensurePhotoInStorage` continues to move inline data URLs to storage and persist encrypted metadata; no code changes made here in this iteration but review noted in tasks.

Notes:
- This iteration centralizes upload/encryption handling inside `firebaseDataService.ensurePhotoInStorage` by passing inline base64 data URLs from the UI. It preserves offline guest behavior while ensuring authenticated uploads will be encrypted by the service.

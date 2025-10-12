# Phase 1 Tasks for feature/encrypt-photos

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Persist `encryptedMetadata` returned by `ensurePhotoInStorage` when creating fish records so encrypted photos remain decryptable.
4. Propagate `encryptedMetadata` through import, update, and sync flows, including local cache rehydration paths.
5. Add regression tests covering encrypted photo persistence and GalleryModal decryption scenarios.
6. Refactor `photoEncryption.test.ts` to use vitest mocks/spies instead of prototype mutation and ensure state restoration.
7. Run `npm test` (or `npm run test:run`) and resolve any failures.
8. Create `.tasks/feature/encrypt-photos-phase1.files1.md` summarizing the files changed in short form.

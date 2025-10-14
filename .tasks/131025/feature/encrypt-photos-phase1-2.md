# Phase 1 Follow-up Tasks for feature/encrypt-photos

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Persist the `encryptedMetadata` returned from `ensurePhotoInStorage` on fish creation so encrypted photos always carry their metadata.
4. Update import, update, and sync pipelines (including local cache hydration) to retain `encryptedMetadata` when photos move between states.
5. Cover encrypted photo persistence and gallery decryption with automated tests.
6. Refactor the decryption-failure unit test to use vitest spies/mocks instead of prototype mutation, restoring the singleton afterward.
7. Run `npm test` (or `npm run test:run`) and address any regressions.
8. Create `.tasks/feature/encrypt-photos.files2.md` listing the modified files in short form.

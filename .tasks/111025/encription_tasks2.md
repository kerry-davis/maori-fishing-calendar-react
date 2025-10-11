1. Make `convertFromFirestore` asynchronous and return decrypted objects (await `encryptionService.decryptObject` when a collection hint is provided).
2. Update every call site (single fetches and collection queries) to await the async converter—replace `forEach` loops with `for…of` or `Promise.all` so arrays contain resolved objects.
3. Add defensive handling for call chains that might receive unresolved Promises (e.g., ensure consuming helpers remain `async` and await results before returning to UI callers).
4. Write regression tests covering encrypted Firestore snapshots to confirm getters return fully decrypted plain objects without Promises embedded.
5. Re-run lint, unit tests, and verify encrypted documents round-trip correctly in both online and offline queue scenarios.

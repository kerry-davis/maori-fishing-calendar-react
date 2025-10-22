# Troubleshooting

| Symptom | Likely Cause | Fix |
| ------- | ------------ | --- |
| Ciphertext shows in UI | Pepper mismatch / rotation | Restore old build & re-encrypt, or plan rotation |
| Migration pill never appears | No plaintext docs OR key not ready | Confirm `encryptionService.isReady()` & existing plaintext |
| Offline queue stuck | Network offline or permission issue | Inspect `syncQueue_<userId>` and console logs |
| PWA not updating | SW cached | Hard refresh / adjust `vite-plugin-pwa` manifest changes |
| Photo decrypt fails (OperationError) | Different salt or pepper per device | Ensure `userSettings/<uid>.encSaltB64` exists and `VITE_KEY_PEPPER` matches |
| Trip log photos missing until edit | Legacy inline photos lacked preview fallback | Update to latest build or ensure photo fields populated |
| IndexedDB “VersionError” on load | Cached DB schema newer than requested | Latest build auto-recovers; refresh again if needed |
| Storage blocked by CORS | Missing origin in bucket CORS | Add origin to `cors.json`, re-apply with `gsutil cors set` |
